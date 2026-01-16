# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TokenPass Server is a peer-to-peer Bitcoin-based identity system implementing the Starfish scheme. It's a Next.js application that provides cryptographic signing, encryption, and identity management using Bitcoin private keys through a REST API. Runs on port 21000 by default.

## Commands

All commands should be run from the `web/` directory:

```bash
cd web
bun dev           # Start development server (port 21000)
bun run build     # Build for production
bun start         # Start production server (port 21000)
bun run lint      # ESLint check
```

## Architecture

```
web/                          # Next.js application
├── src/app/                  # App router pages and API routes
│   ├── page.tsx              # Main UI (wallet management)
│   ├── layout.tsx            # Root layout with theme provider
│   └── api/                  # REST API endpoints
│       ├── auth/route.ts     # POST: Generate access token
│       ├── sign/route.ts     # POST: Sign message (requires token)
│       ├── encrypt/route.ts  # POST: Encrypt message (requires token)
│       ├── register/route.ts # POST: Create new wallet
│       ├── login/route.ts    # POST: Unlock wallet
│       ├── logout/route.ts   # POST: Lock wallet
│       ├── profile/route.ts  # GET/POST: BAP identity
│       ├── export/route.ts   # POST: Export seed/mnemonic
│       └── status/route.ts   # GET: Wallet status
└── src/lib/tokenpass/        # Core tokenpass library
    ├── server.ts             # Main exports for API routes
    ├── crypt.ts              # AES-256-CBC encryption utilities
    ├── key.ts                # Key derivation and management (BIP44 branch 2)
    ├── seed.ts               # Master seed storage with encryption
    ├── state.ts              # Session state and access token management
    └── wallet/               # Bitcoin signing operations
        └── index.ts          # Message signing with @bsv/sdk
```

**Data Flow**: HTTP request → Next.js API route → TokenPass library functions → NeDB storage

**Key Derivation**: Uses BIP44 with branch 2 (non-standard) to avoid overlap with standard wallets. New account per web host, deterministic from master seed.

**Database**: NeDB (embedded JSON) stores files in `~/.tokenpass/`:
- `seed.db` - Encrypted master seed
- `keys.db` - Derived keys per host
- `state.db` - Per-host state and access tokens

## API Endpoints

All endpoints are prefixed with `/api/`:

| Endpoint | Method | Purpose | Auth Required |
|----------|--------|---------|---------------|
| `/api/register` | POST | First-time seed creation with BAP identity | No |
| `/api/login` | POST | Unlock wallet with password | No |
| `/api/logout` | POST | Lock wallet (clear in-memory seed) | No |
| `/api/auth` | POST | Generate OAuth-style access token | Password |
| `/api/sign` | POST | Sign message with derived key | Access token |
| `/api/encrypt` | POST | Encrypt message with derived key | Access token |
| `/api/profile` | GET/POST | Read/write global BAP profile | No |
| `/api/export` | POST | Export seed hex and mnemonic | Password |
| `/api/status` | GET | Check wallet status (created/unlocked) | No |

See [API.md](API.md) for detailed request/response formats.

## Key Dependencies

- `next` - Next.js 16+ framework with App Router
- `react` - React 19+ for UI
- `@bsv/sdk` - Bitcoin operations, HD keys, signing
- `bsv-bap` - Bitcoin Attestation Protocol identity
- `sigma-protocol` - Sigma proofs for cryptographic authentication
- `@seald-io/nedb` - Embedded JSON database (NeDB fork)
- `next-themes` - Dark mode support
- `@radix-ui/*` - UI component primitives
- `tailwindcss` - Styling

## Environment Variables

- `TOKENPASS_HOST` - Server hostname (default: localhost)
- `TOKENPASS_PORT` - Server port (default: 21000)
- `TOKENPASS_ORIGIN_WHITELIST` - Comma-separated CORS origins

## TypeScript

The project is now fully TypeScript-based:
- All API routes use `.ts` extension
- Core library at `web/src/lib/tokenpass/` is TypeScript
- UI components use `.tsx` extension
- Configured with Next.js tsconfig.json

## Authentication

Access tokens are UUID-based with configurable expiration: `once` (10s), `1h`, `1d`, `1w`, `1m`, or `forever`. Required for `/sign` and `/encrypt` endpoints.

Scopes: `read_profile`, `write_profile`, `read_state`, `write_state`, `fund`, `encrypt`, `decrypt`, `transfer`
