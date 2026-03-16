# FA STARX BOT v19.0.0

Multi-Chain Transfer Bot dengan WalletConnect & MetaMask RPC Inject.

## Struktur Folder

```
fa-starx-bot/
├── main.js                          ← Entry point
├── package.json
├── .env.example                     ← Template konfigurasi
│
├── config/
│   └── loadConfiguration.js        ← EnvDecryptor + loadConfiguration()
│
├── core/
│   ├── ModernUI.js                  ← UI terminal (banner, box, spinner)
│   ├── InputHandler.js              ← Wrapper readline
│   └── TransactionQueue.js         ← Antrian nonce per wallet
│
├── auth/
│   ├── TwoFactorAuth.js             ← TOTP RFC 6238 (Google Authenticator)
│   └── GitHubPasswordSync.js       ← Login admin/script + GitHub sync
│
├── bot/
│   ├── CryptoAutoTx.js             ← Core bot: wallet, WalletConnect, RPC
│   └── TelegramFullController.js   ← Handler Telegram Bot lengkap
│
├── transfer/
│   ├── TokenTransfer.js            ← Kirim ERC-20 token
│   ├── EthTransfer.js              ← Kirim ETH native
│   └── AutoTokenDetectionManager.js ← Deteksi & forward token otomatis
│
├── rpc/
│   └── MetaMaskRpcServer.js        ← [v19] Custom RPC server untuk MetaMask
│
├── utils/
│   ├── constants.js                ← NETWORK_CONFIG, ERC20_ABI, GAS_CONFIG
│   ├── validators.js               ← isValidPrivateKey, isValidAddress, sleep
│   ├── gasOptimizer.js             ← SimpleGasOptimizer + AdvancedTokenDetector
│   └── secureConfig.js             ← EnhancedSecureConfigManager
│
└── modes/
    └── terminalMode.js             ← runTerminalMode() untuk CLI
```

## Instalasi

```bash
npm install
```

## Konfigurasi

1. Salin `.env.example` ke `.env`
2. Isi semua nilai yang diperlukan (enkripsi menggunakan script bawaan)

## Menjalankan

```bash
node main.js
```

## Fitur

- ✅ Auto Transaction dengan WalletConnect
- ✅ MetaMask RPC Inject (v19) — DApp connect via custom RPC
- ✅ RPC Management dengan Gas Config (Auto/Manual/Aggressive)
- ✅ Smart Delay Execution
- ✅ Auto-Save RPC dari DApp
- ✅ Multi-session dengan notifikasi Telegram pribadi
- ✅ Generate Wallet Otomatis + Backup Phrase
- ✅ Two Factor Auth (Google Authenticator) — TOTP RFC 6238
- ✅ Transfer Bot (ETH & Token auto-forward, auto-detect)
