// controller.js (v3.7 - Full Fix)

const TelegramBot = require('node-telegram-bot-api');
const { spawn } = require('child_process');
const dotenv = require('dotenv');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const si = require('systeminformation');

// --- CEK FILE .env ---
if (!fs.existsSync('.env')) {
    console.error('❌ FATAL: File .env tidak ditemukan!');
    console.error('Harap jalankan "node setup.js" terlebih dahulu.');
    process.exit(1);
}

dotenv.config();
console.log('ℹ️ File .env dimuat oleh Controller.');

// ===================================
// == ENV DECRYPTOR ==
// ===================================
class EnvDecryptor {
    constructor() {
        this.configKey = this.generateConfigKey();
    }
    generateConfigKey() {
        return crypto.pbkdf2Sync(
            'FASTARX_CONFIG_KEY_2024',
            'CONFIG_SALT_2024',
            50000, 32, 'sha256'
        );
    }
    decryptValue(encryptedValue) {
        if (!encryptedValue) return null;
        try {
            const parts = encryptedValue.split(':');
            if (parts.length !== 2) throw new Error('Format tidak valid.');
            const encryptedData = parts[0];
            const iv = Buffer.from(parts[1], 'hex');
            const decipher = crypto.createDecipheriv('aes-256-cbc', this.configKey, iv);
            let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        } catch (error) {
            console.error(`DECRYPTION FAILED: ${error.message}`);
            return null;
        }
    }
}

// ==========================================================
// == LOAD KONFIGURASI DARI .env ==
// ==========================================================

let TOKEN_CONTROLLER;
let ADMIN_CHAT_ID;

try {
    console.log('🔒 Memuat konfigurasi Controller dari .env...');
    const envDecryptor = new EnvDecryptor();

    // [FIX #1] ADMIN_CHAT_ID juga terenkripsi oleh setup.js
    // Harus pakai ADMIN_CHAT_ID_ENCRYPTED, bukan ADMIN_CHAT_ID
    TOKEN_CONTROLLER = envDecryptor.decryptValue(process.env.CONTROLLER_BOT_TOKEN_ENCRYPTED);
    const adminChatIdStr = envDecryptor.decryptValue(process.env.ADMIN_CHAT_ID_ENCRYPTED);
    ADMIN_CHAT_ID = parseInt(adminChatIdStr, 10);

    if (!TOKEN_CONTROLLER) {
        throw new Error('Gagal mendekripsi CONTROLLER_BOT_TOKEN_ENCRYPTED.');
    }
    if (!adminChatIdStr || isNaN(ADMIN_CHAT_ID)) {
        throw new Error('Gagal mendekripsi ADMIN_CHAT_ID_ENCRYPTED atau nilainya tidak valid.');
    }

    console.log('✅ Konfigurasi Controller berhasil dimuat.');
    console.log(`   └─ Admin Chat ID: ${ADMIN_CHAT_ID}`);

} catch (error) {
    console.error('❌ FATAL: Gagal memuat konfigurasi dari .env.');
    console.error(error.message);
    process.exit(1);
}

// ==========================================================
// == KONFIGURASI BOT ==
// == Menjalankan 'node main.js' langsung (tanpa npm)
// ==========================================================

const botConfigs = {
    'utama': {
        name: 'Bot Utama',
        command: 'node',
        args: ['main.js'],
        cwd: __dirname
    },
    'auto': {
        name: 'Bot Kedua',
        command: 'node',
        args: ['main.js'],
        cwd: path.join(__dirname, 'auto')
    }
};

let runningBots = {};

// ==========================================================
// == INISIALISASI BOT CONTROLLER ==
// ==========================================================

const bot = new TelegramBot(TOKEN_CONTROLLER, { polling: true });

console.log('🤖 Bot Controller (Saklar) Aktif...');
console.log(`Hanya merespon perintah dari Admin ID: ${ADMIN_CHAT_ID}`);

// ==========================================================
// == FUNGSI MENU ==
// ==========================================================

function sendMainMenu(chatId, text = 'Pilih bot yang ingin Anda kontrol:') {
    const statusIconUtama = runningBots['utama'] ? '🟢' : '🔴';
    const statusIconAuto = runningBots['auto'] ? '🟢' : '🔴';
    const opts = {
        reply_markup: {
            inline_keyboard: [
                [{ text: `${statusIconUtama} ${botConfigs.utama.name}`, callback_data: 'menu_bot:utama' }],
                [{ text: `${statusIconAuto} ${botConfigs.auto.name}`, callback_data: 'menu_bot:auto' }],
                [
                    { text: '📊 Cek Status Bot', callback_data: 'status_all' },
                    { text: '🖥️ Cek Status VPS', callback_data: 'status_vps' }
                ]
            ]
        }
    };
    bot.sendMessage(chatId, text, opts).catch((err) => {
        console.warn('Gagal kirim menu:', err.message);
    });
}

function sendBotMenu(chatId, botId, textPrefix = '') {
    const config = botConfigs[botId];
    if (!config) {
        sendMainMenu(chatId, 'Error: Bot tidak dikenal.');
        return;
    }
    const statusText = runningBots[botId] ? 'Berjalan' : 'Mati';
    const messageText = `${textPrefix}Kontrol untuk: *${config.name}*\nStatus saat ini: *${statusText}*`;
    const opts = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: `▶️ Aktifkan`, callback_data: `start_bot:${botId}` },
                    { text: `⏹️ Nonaktifkan`, callback_data: `stop_bot:${botId}` }
                ],
                [{ text: `🔄 Refresh Status`, callback_data: `status_bot:${botId}` }],
                [{ text: '« Kembali ke Menu Utama', callback_data: 'menu_main' }]
            ]
        }
    };
    bot.sendMessage(chatId, messageText, { ...opts, parse_mode: 'Markdown' }).catch((err) => {
        console.warn('Gagal kirim sub-menu:', err.message);
    });
}

// ==========================================================
// == HANDLER PERINTAH & TOMBOL ==
// ==========================================================

bot.onText(/\/start/, (msg) => {
    if (msg.chat.id !== ADMIN_CHAT_ID) {
        bot.sendMessage(msg.chat.id, 'Anda tidak diizinkan menggunakan bot ini.');
        return;
    }
    sendMainMenu(msg.chat.id);
});

bot.on('callback_query', async (callbackQuery) => {
    const msg = callbackQuery.message;
    const data = callbackQuery.data;
    const chatId = msg.chat.id;

    if (chatId !== ADMIN_CHAT_ID) {
        bot.answerCallbackQuery(callbackQuery.id, { text: 'Aksi ditolak.', show_alert: true }).catch(() => {});
        return;
    }

    // [FIX #6] Jawab callback SEGERA sebelum proses apapun
    // Mencegah error "query is too old / query ID is invalid"
    bot.answerCallbackQuery(callbackQuery.id).catch(() => {});

    if (data !== 'status_vps') {
        bot.deleteMessage(chatId, msg.message_id).catch(() => {});
    }

    const [action, botId] = data.split(':');

    switch (action) {
        case 'menu_main':
            sendMainMenu(chatId);
            break;
        case 'menu_bot':
            sendBotMenu(chatId, botId);
            break;
        case 'start_bot':
            startBotProcess(chatId, botId);
            setTimeout(() => sendMainMenu(chatId, 'Perintah aktivasi dikirim...'), 1500);
            break;
        case 'stop_bot':
            stopBotProcess(chatId, botId);
            setTimeout(() => sendMainMenu(chatId, 'Perintah nonaktif dikirim...'), 1500);
            break;
        case 'status_bot': {
            // [FIX #4] Block scope {} agar const tidak konflik antar case
            const statusMsg = checkBotStatus(botId);
            sendBotMenu(chatId, botId, `${statusMsg}\n\n`);
            break;
        }
        case 'status_all': {
            // [FIX #4] Block scope {}
            const allStatusMsg = checkAllBotStatus();
            sendMainMenu(chatId, allStatusMsg);
            break;
        }
        case 'status_vps':
            await checkVpsStatus(chatId);
            break;
    }
});

// ==========================================================
// == FUNGSI KONTROL PROSES ==
// ==========================================================

function startBotProcess(chatId, botId) {
    const config = botConfigs[botId];
    if (!config) {
        bot.sendMessage(chatId, `❌ Konfigurasi bot "${botId}" tidak ditemukan.`).catch(() => {});
        return;
    }
    if (runningBots[botId]) {
        bot.sendMessage(chatId, `⚠️ ${config.name} sudah berjalan.`).catch(() => {});
        return;
    }

    console.log(`Mencoba menjalankan: "${config.command} ${config.args.join(' ')}"...`);
    console.log(`Working Directory: ${config.cwd}`);
    bot.sendMessage(chatId, `🔄 Menjalankan ${config.name}...`).catch(() => {});

    // [FIX #2] Nama variabel 'botProcess' bukan 'process'
    // agar tidak menimpa global process milik Node.js
    const botProcess = spawn(config.command, config.args, {
        stdio: 'inherit',
        cwd: config.cwd
    });

    runningBots[botId] = botProcess;

    botProcess.on('close', (code) => {
        console.log(`${config.name} berhenti dengan kode: ${code}`);
        // Hanya kirim notif jika berhenti sendiri (bukan dimatikan manual)
        if (runningBots[botId]) {
            bot.sendMessage(chatId, `❌ ${config.name} berhenti sendiri (Kode: ${code}).`).catch(() => {});
            delete runningBots[botId];
        }
    });

    botProcess.on('error', (err) => {
        console.error(`Gagal memulai ${config.name}:`, err);
        bot.sendMessage(chatId, `❌ Gagal menjalankan ${config.name}: ${err.message}`).catch(() => {});
        delete runningBots[botId];
    });

    setTimeout(() => {
        if (runningBots[botId]) {
            console.log(`${config.name} berhasil dijalankan.`);
            bot.sendMessage(chatId, `✅ ${config.name} telah diaktifkan!`).catch(() => {});
        }
    }, 1500);
}

function stopBotProcess(chatId, botId) {
    const config = botConfigs[botId];
    if (!config) {
        bot.sendMessage(chatId, `❌ Konfigurasi bot "${botId}" tidak ditemukan.`).catch(() => {});
        return;
    }

    // [FIX #2] Nama variabel 'botProcess' bukan 'process'
    const botProcess = runningBots[botId];
    if (!botProcess) {
        bot.sendMessage(chatId, `ℹ️ ${config.name} memang sudah nonaktif.`).catch(() => {});
        return;
    }

    console.log(`Mematikan ${config.name}...`);
    bot.sendMessage(chatId, `🔄 Mematikan ${config.name}...`).catch(() => {});

    // [FIX #3] Kill dulu, delete setelah berhasil — mencegah proses zombie
    const killed = botProcess.kill('SIGINT');

    if (killed) {
        delete runningBots[botId];
        console.log(`${config.name} berhasil dinonaktifkan.`);
        bot.sendMessage(chatId, `✅ ${config.name} telah dinonaktifkan.`).catch(() => {});
    } else {
        console.log(`Gagal mematikan ${config.name}.`);
        bot.sendMessage(chatId, `❌ Gagal mematikan ${config.name}. Coba lagi.`).catch(() => {});
    }
}

// ==========================================================
// == FUNGSI STATUS VPS ==
// ==========================================================

function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1);
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

async function checkVpsStatus(chatId) {
    try {
        const msg = await bot.sendMessage(chatId, '🖥️ Mengecek status VPS...');

        // [FIX CPU] Ambil baseline dulu, tunggu 500ms, baru ukur lagi
        // si.currentLoad() butuh 2 titik data untuk hitung % CPU yang akurat
        // Tanpa ini, hasil pertama sering 0% atau loncat tidak stabil
        await si.currentLoad();
        await new Promise(r => setTimeout(r, 500));

        const [load, memInfo, diskInfo] = await Promise.all([
            si.currentLoad(), // Pengukuran kedua = akurat
            si.mem(),
            si.fsSize()
        ]);

        const cpuUsage = load.currentLoad;
        const ramTotal = memInfo.total;
        const ramActuallyUsed = ramTotal - memInfo.available;
        const ramUsedPercent = ramTotal > 0 ? (ramActuallyUsed / ramTotal) * 100 : 0;

        const rootDisk = diskInfo.find(d => d.mount === '/') || diskInfo[0];
        let diskText = '   └─ Data tidak tersedia';
        if (rootDisk) {
            diskText = `   ├─ Terpakai   : ${formatBytes(rootDisk.used)} / ${formatBytes(rootDisk.size)}\n   └─ Penggunaan : ${(rootDisk.use || 0).toFixed(2)} %`;
        }

        // [FIX #5] Pakai *teks* bukan **teks** — Markdown Telegram hanya support single asterisk
        const pesan = `🖥️ *--- Status VPS ---* 🖥️

🔥 *CPU*
   └─ Penggunaan: ${cpuUsage.toFixed(2)} %

🧠 *RAM (Aktual)*
   ├─ Terpakai   : ${formatBytes(ramActuallyUsed)} / ${formatBytes(ramTotal)}
   └─ Penggunaan : ${ramUsedPercent.toFixed(2)} %

💾 *DISK ( / )*
${diskText}`;

        bot.editMessageText(pesan, {
            chat_id: chatId,
            message_id: msg.message_id,
            parse_mode: 'Markdown'
        }).catch(() => {});

    } catch (error) {
        console.error('Gagal mengecek status VPS:', error);
        bot.sendMessage(chatId, `❌ Gagal mengambil status VPS: ${error.message}`).catch(() => {});
    }
}

// ==========================================================
// == FUNGSI STATUS BOT ==
// ==========================================================

function checkBotStatus(botId) {
    const config = botConfigs[botId];
    if (!config) return `⚠️ Bot "${botId}" tidak dikenal.`;
    return runningBots[botId]
        ? `📊 Status *${config.name}*: 🟢 AKTIF`
        : `📊 Status *${config.name}*: 🔴 NONAKTIF`;
}

function checkAllBotStatus() {
    let statusText = '📊 *--- Status Semua Bot ---*\n\n';
    for (const id in botConfigs) {
        const config = botConfigs[id];
        const icon = runningBots[id] ? '🟢' : '🔴';
        statusText += `${icon} *${config.name}*: ${runningBots[id] ? 'AKTIF' : 'NONAKTIF'}\n`;
    }
    return statusText;
}

// ==========================================================
// == HANDLER LAIN ==
// ==========================================================

bot.on('message', (msg) => {
    if (msg.chat.id !== ADMIN_CHAT_ID) return;
    if (msg.text && !msg.text.startsWith('/')) {
        sendMainMenu(msg.chat.id, 'Perintah tidak dikenal. Menampilkan menu utama:');
    }
});

bot.on('polling_error', (error) => {
    if (error.message && error.message.includes('409 Conflict')) {
        console.warn('⚠️ Conflict terdeteksi (sisa proses lama), mengabaikan...');
    } else {
        console.error(`Polling Error: ${error.code} - ${error.message}`);
    }
});
