# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TokenPass Server is a peer-to-peer Bitcoin-based identity system implementing the Starfish scheme. It's an Express web server that provides cryptographic signing, encryption, and identity management using Bitcoin private keys. Runs on port 21000 by default.

## Commands

```bash
bun run dev       # Start development server
bun run start     # Start production server
bun test          # Run all tests
bun test src/wallet/bitcore-message.test.js  # Run single test file
bun run lint      # Biome lint check
bun run lint:fix  # Auto-fix lint issues
```

## Architecture

```
bin/tokenpass.js          # CLI entry point
src/index.js              # Express app with all HTTP endpoints
├── src/wallet/index.js   # Bitcoin operations (signing, encryption, key derivation)
├── src/key.js            # Key management (NeDB storage, per-host keys)
├── src/seed.js           # Master seed management with AES encryption
├── src/state.js          # Session/auth state database
├── src/crypt.ts          # AES-256-CBC encryption utilities
└── src/utils/mnemonic.js # BIP39 mnemonic support
```

**Data Flow**: HTTP request → Express endpoint → Wallet operations → NeDB storage

**Key Derivation**: Uses BIP44 with branch 2 (non-standard) to avoid overlap with standard wallets. New account per web host, deterministic from master seed.

**Database**: NeDB (embedded JSON) stores files in `~/.tokenpass/`:
- `seed.db` - Encrypted master seed
- `keys.db` - Derived keys per host
- `state.db` - Per-host state and access tokens

## API Endpoints

| Endpoint | Purpose |
|----------|---------|
| POST `/sign` | Sign message with wallet key (requires access token) |
| POST `/encrypt` | Encrypt message (requires access token) |
| POST `/register` | First-time seed creation with BAP identity |
| POST `/import` | Import mnemonic/seed |
| POST `/auth` | Generate OAuth-style access token |
| POST `/login` | Decrypt wallet with password |
| GET/POST `/state` | Per-host state storage |
| GET/POST `/profile` | Global profile storage |

## Key Dependencies

- `@bsv/sdk` - Bitcoin operations, HD keys, signing
- `bsv-bap` - Bitcoin Attestation Protocol identity
- `sigma-protocol` - Sigma proofs
- `nedb` - Embedded JSON database

## Environment Variables

- `TOKENPASS_HOST` - Server hostname (default: localhost)
- `TOKENPASS_PORT` - Server port (default: 21000)
- `TOKENPASS_ORIGIN_WHITELIST` - Comma-separated CORS origins

## TypeScript Migration

Project is transitioning to TypeScript. New files use `.ts` extension:
- `src/crypt.ts` - Completed
- `src/state.ts` - Completed

Legacy `.js` files coexist during migration.

## Authentication

Access tokens are UUID-based with configurable expiration: `once` (10s), `1h`, `1d`, `1w`, `1m`, or `forever`. Required for `/sign` and `/encrypt` endpoints.

Scopes: `read_profile`, `write_profile`, `read_state`, `write_state`, `fund`, `encrypt`, `decrypt`, `transfer`
