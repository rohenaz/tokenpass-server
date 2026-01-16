# tokenpass-server

> A Peer to Peer Identity System, powered by Bitcoin based on Starfish.

- Official Website: https://tokenpass.app
- Original Starfish Server Video Explanation: https://www.youtube.com/watch?v=fglt2jkVpQA

![poster](poster.png)

## Introduction

**tokenpass-server** is an implementation of the Starfish identity scheme, built as a Next.js application. It provides cryptographic signing, encryption, and identity management using Bitcoin private keys through a REST API.

**[tokenpass-desktop](https://github.com/rohenaz/tokenpass-desktop)** is a cross-platform desktop app (Mac, Windows, Linux) that provides a native interface to tokenpass-server.

## How tokenpass-server works

![workflow](workflow.png)

TokenPass implements the Starfish peer-to-peer identity scheme:

1. Users create a wallet protected by a password-encrypted master seed
2. Web applications request access tokens with specific scopes and expiration times
3. Applications make authenticated API calls to sign messages or encrypt data
4. Each web host gets a unique derived key for isolated identity per domain

The core signing flow:
- Application calls `/auth` with password and host to get an access token
- Application calls `/sign` with the access token to sign messages
- Server returns signature along with address and timestamp

Response format:

```json
{
  "address": "<Signer Bitcoin Address>",
  "sig": "<Signature>",
  "message": "<The message that was signed>",
  "ts": <Unix timestamp>
}
```

## Quick Start

### Prerequisites
- [Bun](https://bun.sh) (recommended) or Node.js 18+

### Installation

```bash
git clone https://github.com/rohenaz/tokenpass-server.git
cd tokenpass-server/web
bun install
```

### Running the Development Server

```bash
cd web
bun dev
```

The server will start at `http://localhost:21000`.

### Production Build

```bash
cd web
bun run build
bun start
```

## First Time Setup

1. Start the server (see above)
2. Open `http://localhost:21000` in your browser
3. Click "Register" to create a new wallet
4. Set a strong password (this encrypts your master seed)
5. Optionally set your display name and other BAP profile attributes

Your encrypted wallet is stored in `~/.tokenpass/seed.db`.

## API Usage

Applications interact with tokenpass-server through its REST API. See [API.md](API.md) for full documentation.

**Basic signing example:**

```javascript
// 1. Get access token
const authResponse = await fetch("http://localhost:21000/api/auth", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    password: "your-wallet-password",
    host: "example.com",
    expire: "1h",
    scopes: "sign"
  })
});
const { accessToken } = await authResponse.json();

// 2. Sign a message
const signResponse = await fetch("http://localhost:21000/api/sign", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": accessToken
  },
  body: JSON.stringify({
    message: "Sign this message!"
  })
});
const signature = await signResponse.json();
console.log(signature);
```

## Architecture

TokenPass is built as a Next.js application with TypeScript:

```
web/                          # Next.js application
├── src/app/                  # App router pages and API routes
│   ├── page.tsx              # Main UI (wallet management)
│   └── api/                  # REST API endpoints
│       ├── auth/             # Authentication & access tokens
│       ├── sign/             # Message signing
│       ├── encrypt/          # Message encryption
│       ├── register/         # Wallet creation
│       ├── login/            # Wallet unlock
│       ├── logout/           # Clear session
│       ├── profile/          # BAP identity management
│       ├── export/           # Seed/mnemonic export
│       └── status/           # Wallet status check
└── src/lib/tokenpass/        # Core tokenpass library
    ├── crypt.ts              # AES-256-CBC encryption utilities
    ├── key.ts                # Key derivation and management (BIP44)
    ├── seed.ts               # Master seed storage and encryption
    ├── state.ts              # Session state and access tokens
    └── wallet/               # Bitcoin signing operations
```

**Data Flow**: HTTP request → Next.js API route → TokenPass library → NeDB storage

**Key Derivation**: Uses BIP44 with branch 2 (non-standard) to avoid overlap with standard wallets. Each web host gets a unique deterministic account derived from the master seed.

**Database**: NeDB (embedded JSON) stores encrypted data in `~/.tokenpass/`:
- `seed.db` - Encrypted master seed (AES-256-CBC)
- `keys.db` - Derived keys per host
- `state.db` - Per-host state and access tokens

## Authentication Scopes

Access tokens support the following scopes:

- `read_profile` - Read BAP identity attributes
- `write_profile` - Modify BAP identity attributes
- `read_state` - Read per-host application state
- `write_state` - Write per-host application state
- `fund` - Request funding/payment
- `encrypt` - Encrypt messages
- `decrypt` - Decrypt messages
- `transfer` - Transfer tokens/assets
- `sign` - Sign messages (implied for `/sign` endpoint)

## Key Features

- **Bitcoin-based Identity**: Each identity is a Bitcoin key pair with BAP (Bitcoin Attestation Protocol) support
- **Per-host Isolation**: Deterministic key derivation gives each web host a unique identity
- **Password-encrypted Storage**: Master seed is encrypted with AES-256-CBC before storage
- **OAuth-style Tokens**: Access tokens with configurable expiration (`once`, `1h`, `1d`, `1w`, `1m`, `forever`)
- **Message Signing**: Sign arbitrary messages with Bitcoin private keys
- **Message Encryption**: ECIES encryption using derived keys
- **BIP39 Mnemonic Support**: Import/export wallets using 12/24-word phrases

## Updates Since Starfish

- Migrated from Express to Next.js with TypeScript
- Added BAP (Bitcoin Attestation Protocol) identity support
- Enhanced access token system with scopes and expiration
- Support for binary data signing with custom encoding
- Web-based UI for wallet management
- Migration to @bsv/sdk for Bitcoin operations

## Development

```bash
cd web
bun install      # Install dependencies
bun dev          # Start dev server (port 21000)
bun run lint     # ESLint check
bun run build    # Production build
```

## Environment Variables

- `TOKENPASS_HOST` - Server hostname (default: `localhost`)
- `TOKENPASS_PORT` - Server port (default: `21000`)
- `TOKENPASS_ORIGIN_WHITELIST` - Comma-separated CORS origins

## License

See [LICENSE](LICENSE) file for details.

## Related Projects

- [tokenpass-desktop](https://github.com/rohenaz/tokenpass-desktop) - Desktop app wrapper
- [Starfish](https://www.youtube.com/watch?v=fglt2jkVpQA) - Original concept and specification
