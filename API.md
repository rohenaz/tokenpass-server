# TokenPass API Reference

This document describes all API endpoints available in TokenPass Server.

All endpoints are prefixed with `/api/` and accept/return JSON unless otherwise noted.

## Table of Contents

- [Authentication Flow](#authentication-flow)
- [Wallet Management](#wallet-management)
  - [POST /api/register](#post-apiregister)
  - [POST /api/login](#post-apilogin)
  - [POST /api/logout](#post-apilogout)
  - [GET /api/status](#get-apistatus)
  - [POST /api/export](#post-apiexport)
- [Access Tokens](#access-tokens)
  - [POST /api/auth](#post-apiauth)
- [Cryptographic Operations](#cryptographic-operations)
  - [POST /api/sign](#post-apisign)
  - [POST /api/encrypt](#post-apiencrypt)
- [Identity Management](#identity-management)
  - [GET /api/profile](#get-apiprofile)
  - [POST /api/profile](#post-apiprofile)
- [Development](#development)
  - [GET /api/debug](#get-apidebug)

---

## Authentication Flow

TokenPass uses a two-step authentication flow:

1. **Wallet Setup** (one-time): Create a wallet with `POST /api/register`
2. **Unlock Wallet**: Use `POST /api/login` to unlock with your password
3. **Get Access Token**: Call `POST /api/auth` with password and host to get an access token
4. **Make API Calls**: Use the access token in the `Authorization` header for protected endpoints

```javascript
// Example flow
// 1. Register (first time only)
await fetch("http://localhost:21000/api/register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    password: "secure-password",
    displayName: "Alice"
  })
});

// 2. Login (unlocks wallet)
await fetch("http://localhost:21000/api/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ password: "secure-password" })
});

// 3. Get access token
const authRes = await fetch("http://localhost:21000/api/auth", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    password: "secure-password",
    host: "example.com",
    expire: "1h",
    scopes: "sign,encrypt"
  })
});
const { accessToken } = await authRes.json();

// 4. Sign a message
const signRes = await fetch("http://localhost:21000/api/sign", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": accessToken
  },
  body: JSON.stringify({ message: "Hello World" })
});
```

---

## Wallet Management

### POST /api/register

Create a new wallet with an encrypted master seed. This should only be called once during initial setup.

**Request Body:**
```json
{
  "password": "string (required)",
  "displayName": "string (optional)",
  "paymail": "string (optional)",
  "logo": "string (optional, URL or data URI)"
}
```

**Response (200 OK):**
```json
{
  "success": true
}
```

**Error Responses:**
- `400 Bad Request`: Missing password
- `500 Internal Server Error`: Wallet already exists or creation failed

**Example:**
```bash
curl -X POST http://localhost:21000/api/register \
  -H "Content-Type: application/json" \
  -d '{
    "password": "my-secure-password",
    "displayName": "Alice",
    "paymail": "alice@example.com"
  }'
```

**Notes:**
- Password is used to encrypt the master seed with AES-256-CBC
- Creates a BAP (Bitcoin Attestation Protocol) identity
- Seed is stored in `~/.tokenpass/seed.db`
- Display name, paymail, and logo are stored in the global profile

---

### POST /api/login

Unlock the wallet by decrypting the master seed with the correct password.

**Request Body:**
```json
{
  "password": "string (required)"
}
```

**Response (200 OK):**
```json
{
  "success": true
}
```

**Error Responses:**
- `400 Bad Request`: Missing password
- `401 Unauthorized`: Invalid password

**Example:**
```bash
curl -X POST http://localhost:21000/api/login \
  -H "Content-Type: application/json" \
  -d '{"password": "my-secure-password"}'
```

**Notes:**
- Must be called after server restart or `/api/logout`
- Decrypts seed and keeps it in memory for API operations
- Does not create access tokens (use `/api/auth` for that)

---

### POST /api/logout

Lock the wallet by clearing the in-memory decrypted seed.

**Request Body:**
None required (empty POST)

**Response (200 OK):**
```json
{
  "success": true
}
```

**Example:**
```bash
curl -X POST http://localhost:21000/api/logout
```

**Notes:**
- Clears the in-memory seed without deleting the encrypted database
- Access tokens remain valid until expiration but cannot be used (wallet locked)
- Wallet must be unlocked again with `/api/login` before using protected endpoints

---

### GET /api/status

Check the current wallet status.

**Request:** None required

**Response (200 OK):**
```json
{
  "seed": true,           // true if wallet exists
  "unlocked": true,       // true if wallet is unlocked
  "keys": [...],          // array of derived keys (empty if locked)
  "states": [...]         // array of access token states (empty if locked)
}
```

**Example:**
```bash
curl http://localhost:21000/api/status
```

**Notes:**
- `seed: false` means no wallet exists yet (need to register)
- `seed: true, unlocked: false` means wallet exists but is locked (need to login)
- `seed: true, unlocked: true` means ready for operations

---

### POST /api/export

Export the master seed and mnemonic phrase. Requires password authentication.

**Request Body:**
```json
{
  "password": "string (required)"
}
```

**Response (200 OK):**
```json
{
  "seed": "hex-encoded-seed",
  "mnemonic": "twelve or twenty-four word phrase"
}
```

**Error Responses:**
- `400 Bad Request`: Missing password
- `401 Unauthorized`: Invalid password

**Example:**
```bash
curl -X POST http://localhost:21000/api/export \
  -H "Content-Type: application/json" \
  -d '{"password": "my-secure-password"}'
```

**Security Warning:**
- Never share your seed or mnemonic with anyone
- Store backups securely offline
- Anyone with the seed/mnemonic has full control of your identity

---

## Access Tokens

### POST /api/auth

Generate an OAuth-style access token for a specific web host.

**Request Body:**
```json
{
  "password": "string (required)",
  "host": "string (required, domain name)",
  "expire": "string (optional, default: 'once')",
  "scopes": "string (optional, comma-separated)",
  "icon": "string (optional, URL or data URI)"
}
```

**Expire Options:**
- `once` - 10 seconds (default)
- `1h` - 1 hour
- `1d` - 1 day
- `1w` - 1 week
- `1m` - 1 month
- `forever` - no expiration

**Scope Options:**
- `read_profile` - Read BAP identity attributes
- `write_profile` - Modify BAP identity attributes
- `read_state` - Read per-host application state
- `write_state` - Write per-host application state
- `fund` - Request funding/payment
- `encrypt` - Encrypt messages
- `decrypt` - Decrypt messages
- `transfer` - Transfer tokens/assets
- `sign` - Sign messages (implied for `/sign` endpoint)

**Response (200 OK):**
```json
{
  "success": true,
  "accessToken": "uuid-v4-token",
  "expireTime": 1234567890123,
  "host": "example.com"
}
```

**Error Responses:**
- `400 Bad Request`: Missing password or host
- `401 Unauthorized`: Invalid password
- `500 Internal Server Error`: Token creation failed

**Example:**
```bash
curl -X POST http://localhost:21000/api/auth \
  -H "Content-Type: application/json" \
  -d '{
    "password": "my-secure-password",
    "host": "example.com",
    "expire": "1h",
    "scopes": "sign,encrypt,read_profile"
  }'
```

**Notes:**
- Each host gets a unique derived Bitcoin key (BIP44 branch 2)
- Access token is a UUID v4
- Token is stored in `~/.tokenpass/state.db`
- Use the token in the `Authorization` header for protected endpoints

---

## Cryptographic Operations

### POST /api/sign

Sign a message with the derived Bitcoin private key for the authenticated host.

**Authentication:** Requires access token in `Authorization` header

**Request Body:**
```json
{
  "message": "string (required)",
  "encoding": "string (optional, default: 'utf8')"
}
```

**Encoding Options:**
- `utf8` - UTF-8 string (default)
- `hex` - Hexadecimal encoding
- `base64` - Base64 encoding

**Response (200 OK):**
```json
{
  "address": "1BitcoinAddress...",
  "sig": "signature-string",
  "message": "original-message",
  "ts": 1234567890123
}
```

**Error Responses:**
- `401 Unauthorized`: Wallet locked, missing token, invalid token, or expired token
  - Code 1: Wallet is locked (need to login)
  - Code 2: Missing authorization header
  - Code 3: Invalid access token
  - Code 5: Access token has expired
- `417 Expectation Failed`: No wallet exists

**Example:**
```bash
# First get an access token
TOKEN=$(curl -s -X POST http://localhost:21000/api/auth \
  -H "Content-Type: application/json" \
  -d '{"password":"my-password","host":"example.com","expire":"1h"}' \
  | jq -r '.accessToken')

# Then sign a message
curl -X POST http://localhost:21000/api/sign \
  -H "Content-Type: application/json" \
  -H "Authorization: $TOKEN" \
  -d '{"message": "Hello World"}'
```

**Notes:**
- Signature uses Bitcoin message signing (BSM) format
- Each host gets a unique address (deterministic from master seed)
- Supports binary data signing with hex/base64 encoding
- Used for sigma protocol message hashes

---

### POST /api/encrypt

Encrypt a message with the derived Bitcoin private key for the authenticated host.

**Authentication:** Requires access token in `Authorization` header

**Request Body:**
```json
{
  "message": "string (required)"
}
```

**Response (200 OK):**
```json
{
  "encrypted": "encrypted-message-data"
}
```

**Error Responses:**
- `401 Unauthorized`: Wallet locked, missing token, invalid token, or expired token
  - Code 1: Wallet is locked (need to login)
  - Code 2: Missing authorization header
  - Code 3: Invalid access token
  - Code 5: Access token has expired
- `417 Expectation Failed`: No wallet exists

**Example:**
```bash
# First get an access token
TOKEN=$(curl -s -X POST http://localhost:21000/api/auth \
  -H "Content-Type: application/json" \
  -d '{"password":"my-password","host":"example.com","expire":"1h","scopes":"encrypt"}' \
  | jq -r '.accessToken')

# Then encrypt a message
curl -X POST http://localhost:21000/api/encrypt \
  -H "Content-Type: application/json" \
  -H "Authorization: $TOKEN" \
  -d '{"message": "Secret data"}'
```

**Notes:**
- Uses ECIES (Elliptic Curve Integrated Encryption Scheme)
- Message can be decrypted by anyone with the corresponding public key
- Each host uses a different encryption key

---

## Identity Management

### GET /api/profile

Retrieve the global BAP (Bitcoin Attestation Protocol) identity profile.

**Authentication:** None required

**Request:** None required

**Response (200 OK):**
```json
{
  "host": "global",
  "displayName": "Alice",
  "paymail": "alice@example.com",
  "logo": "https://...",
  "bapID": "identity-key-string",
  ...
}
```

**Example:**
```bash
curl http://localhost:21000/api/profile
```

**Notes:**
- Returns empty object `{}` if no profile exists yet
- Profile is created during registration
- Stored in `~/.tokenpass/state.db` with host="global"

---

### POST /api/profile

Update the global BAP identity profile.

**Authentication:** None required (consider adding authentication in production)

**Request Body:**
```json
{
  "displayName": "string (optional)",
  "paymail": "string (optional)",
  "logo": "string (optional)",
  "customField": "any value"
}
```

**Response (200 OK):**
```json
{
  "success": true
}
```

**Example:**
```bash
curl -X POST http://localhost:21000/api/profile \
  -H "Content-Type: application/json" \
  -d '{
    "displayName": "Alice Updated",
    "bio": "Bitcoin developer"
  }'
```

**Notes:**
- Merges provided fields with existing profile
- `host` field is always set to "global" and cannot be changed
- Any JSON-serializable data can be stored

---

## Development

### GET /api/debug

Debug endpoint to inspect the seed database state.

**Authentication:** None required

**Request:** None required

**Response (200 OK):**
```json
{
  "filename": "/Users/username/.tokenpass/seed.db",
  "count": 1,
  "hasDoc": true,
  "docKeys": ["_id", "hex", "mnemonic", "createdAt"]
}
```

**Example:**
```bash
curl http://localhost:21000/api/debug
```

**Security Warning:**
- This endpoint should be disabled in production
- Exposes database structure (but not the encrypted data itself)

---

## Error Handling

All endpoints return errors in a consistent format:

```json
{
  "error": "Error message description",
  "code": 1,
  "success": false
}
```

**Common Error Codes:**
- `1` - Wallet is locked
- `2` - Missing authorization header
- `3` - Invalid access token
- `5` - Access token has expired

**HTTP Status Codes:**
- `200` - Success
- `400` - Bad Request (missing required fields)
- `401` - Unauthorized (invalid password or token)
- `417` - Expectation Failed (wallet not created)
- `500` - Internal Server Error

---

## Rate Limiting

Currently, no rate limiting is implemented. Consider adding rate limiting in production environments.

## CORS

Configure allowed origins using the `TOKENPASS_ORIGIN_WHITELIST` environment variable:

```bash
TOKENPASS_ORIGIN_WHITELIST=https://app1.com,https://app2.com bun dev
```

Default: All origins allowed in development

---

## Security Best Practices

1. **Always use HTTPS** in production
2. **Set strong passwords** for wallet encryption
3. **Use short-lived tokens** (`1h` or `1d` instead of `forever`)
4. **Limit scopes** to only what's needed
5. **Never expose seed/mnemonic** except for secure backups
6. **Disable debug endpoints** in production
7. **Implement rate limiting** to prevent brute force attacks
8. **Validate host origins** to prevent unauthorized access
9. **Keep backups** of your `~/.tokenpass/` directory (encrypted)
10. **Use different hosts** for different applications (automatic key isolation)

---

## Database Storage

All data is stored in `~/.tokenpass/`:

- `seed.db` - Encrypted master seed (AES-256-CBC)
- `keys.db` - Derived Bitcoin keys per host
- `state.db` - Access tokens and per-host state

Files are in NeDB JSON format and can be inspected with any text editor (seed is encrypted).
