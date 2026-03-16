'use strict';
const { ethers } = require('ethers');
const ModernUI = require('../core/ModernUI');
const { SimpleGasOptimizer } = require('../utils/gasOptimizer');
const { GAS_CONFIG } = require('../utils/constants');
const { sleep } = require('../utils/validators');
const ui = new ModernUI();

// ===== ETH TRANSFER CLASS
// ===== ETH TRANSFER CLASS =====
class EthTransfer {
    constructor(providerUrl, privateKey, chainId, networkName, telegramNotifier = null) {
        this.provider = new ethers.JsonRpcProvider(providerUrl);
        this.wallet = new ethers.Wallet(privateKey, this.provider);
        this.networkName = networkName;
        this.telegramNotifier = telegramNotifier;
        this.gasOptimizer = new SimpleGasOptimizer(this.provider, chainId);
        this.isRunning = true;
        this.lastBalance = 0n; // BigInt untuk konsistensi
        this.consecutiveErrors = 0;
        this.maxConsecutiveErrors = 3;
    }

    async getEthBalance() {
        const balance = await this.provider.getBalance(this.wallet.address);
        return parseFloat(ethers.formatEther(balance));
    }

    async sendEth(toAddress) {
        try {
            // Gunakan BigInt untuk hindari floating point error
            const rawBalance = await this.provider.getBalance(this.wallet.address);
            const minBalanceWei = ethers.parseEther(GAS_CONFIG.MIN_ETH_BALANCE.toString());

            if (rawBalance <= minBalanceWei) {
                return null;
            }

            // Hitung gas dulu, lalu kurangi dari saldo
            const gasPrice = await this.gasOptimizer.getOptimalGasPrice();
            const gasLimitBig = BigInt(GAS_CONFIG.GAS_LIMIT);
            const gasCostWei = gasPrice * gasLimitBig;

            // amountToSend = balance - minBalance - gasCost (semua BigInt)
            const amountToSendWei = rawBalance - minBalanceWei - gasCostWei;

            if (amountToSendWei <= 0n) {
                ui.showNotification('warning', 'Balance terlalu kecil setelah dikurangi gas fee');
                return null;
            }

            const amountToSendEth = parseFloat(ethers.formatEther(amountToSendWei));
            const gasCost = await this.gasOptimizer.calculateTransactionCost(GAS_CONFIG.GAS_LIMIT);

            ui.showTransactionSummary({ name: 'Ethereum', symbol: 'ETH' }, amountToSendEth, gasCost, null, this.networkName);

            const currentNonce = await this.gasOptimizer.getCurrentNonce(this.wallet.address);

            ui.startLoading('Mengirim transaksi ETH...');

            const tx = await this.wallet.sendTransaction({
                to: toAddress,
                value: amountToSendWei,
                gasPrice: gasPrice,
                gasLimit: gasLimitBig,
                nonce: currentNonce
            });

            this.gasOptimizer.updateNonce(this.wallet.address);

            if (this.telegramNotifier) {
                await this.telegramNotifier.sendNotification(
                    `🟢 ETH TRANSFER TERDETEKSI

💰 Amount: ${amountToSendEth.toFixed(8)} ETH
🌐 Network: ${this.networkName}
📄 TX Hash: ${tx.hash.slice(0, 10)}...${tx.hash.slice(-8)}
⏰ Time: ${new Date().toLocaleString()}`
                );
            }

            ui.startLoading('⏳ Menunggu konfirmasi transaksi...');
            const receipt = await tx.wait();

            ui.stopLoading();
            ui.showNotification('success', `Berhasil kirim ${amountToSendEth.toFixed(8)} ETH`);
            this.consecutiveErrors = 0;

            if (this.telegramNotifier) {
                await this.telegramNotifier.sendNotification(
                    `🎉 ETH TRANSFER BERHASIL

✅ Status: Confirmed
💰 Amount: ${amountToSendEth.toFixed(8)} ETH
🌐 Network: ${this.networkName}
📄 TX Hash: ${receipt.hash.slice(0, 10)}...${receipt.hash.slice(-8)}
⏰ Completed: ${new Date().toLocaleString()}`
                );
            }

            return { hash: receipt.hash, amount: amountToSendEth, symbol: 'ETH' };
            
        } catch (error) {
            this.consecutiveErrors++;
            ui.stopLoading();
            
            if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
                ui.showNotification('error', `Too many consecutive errors. Stopping bot.`);
                this.stop();
                return null;
            }

            if (error.message.includes('nonce') || error.message.includes('NONCE_EXPIRED')) {
                ui.showNotification('warning', 'Nonce error detected. Clearing cache...');
                this.gasOptimizer.clearNonceCache(this.wallet.address);
                await sleep(2000);
            } else {
                ui.showNotification('error', `ETH transfer failed: ${error.message}`);
            }
            
            return null;
        }
    }

    async checkAndForward(toAddress) {
        try {
            const rawBalance = await this.provider.getBalance(this.wallet.address);
            const minBalanceWei = ethers.parseEther(GAS_CONFIG.MIN_ETH_BALANCE.toString());
            const ethBalance = parseFloat(ethers.formatEther(rawBalance));
            
            if (rawBalance <= minBalanceWei) {
                ui.startLoading(`Monitoring ETH - Balance: ${ethBalance.toFixed(8)} ETH`);
                this.lastBalance = rawBalance;
                this.consecutiveErrors = 0;
                return;
            }

            // Kirim jika: lastBalance kosong/kecil ATAU ada saldo baru masuk (refill)
            const lastBalWei = this.lastBalance || 0n;
            if (rawBalance > minBalanceWei && (lastBalWei <= minBalanceWei || rawBalance > lastBalWei)) {
                await this.sendEth(toAddress);
            }
            
            this.lastBalance = rawBalance;
            
        } catch (error) {
            this.consecutiveErrors++;
            if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
                ui.showNotification('error', `Too many monitoring errors. Stopping bot.`);
                this.stop();
                return;
            }
            ui.startLoading('Monitoring ETH - Checking balance...');
        }
    }

    startAutoForward(toAddress, accountName = null) {
        ui.showNotification('info', `Started ETH monitoring on ${this.networkName}`);
        
        if (this.telegramNotifier) {
            this.telegramNotifier.sendNotification(
                this.telegramNotifier.formatBotStarted(
                    'ETH AUTO-FORWARD',
                    this.networkName,
                    this.wallet.address,
                    toAddress,
                    null,
                    accountName
                )
            );
        }

        this.checkAndForward(toAddress);
        
        this.intervalId = setInterval(() => {
            if (this.isRunning) this.checkAndForward(toAddress);
        }, GAS_CONFIG.CHECK_INTERVAL_MS);
    }

    stop() {
        this.isRunning = false;
        if (this.intervalId) clearInterval(this.intervalId);
        ui.stopLoading();
        ui.showNotification('info', 'ETH monitoring stopped');
    }
}

module.exports = EthTransfer;
