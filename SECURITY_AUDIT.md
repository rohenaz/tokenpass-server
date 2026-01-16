# Security Audit Report: TokenPass Library

**Audit Date:** 2026-01-16  
**Auditor:** Security Code Auditor  
**Scope:** Crypto/Auth code in web/src/lib/tokenpass and web/src/app/api

---

## Executive Summary

This audit identified **2 Critical**, **4 High**, **5 Medium**, and **4 Low/Info** severity issues in the TokenPass cryptographic and authentication implementation. The most severe issues relate to weak key derivation for encryption, timing attack vulnerabilities in token validation, and missing input validation across API endpoints.

The codebase demonstrates reasonable architecture but lacks defense-in-depth measures expected for a cryptographic wallet system handling Bitcoin private keys.

---

## Critical Findings

### C-01: Weak Key Derivation Function for AES Encryption

**File:** `web/src/lib/tokenpass/crypt.ts:16-21`

**Issue:** Password-based key derivation uses a single SHA-256 hash instead of a proper KDF (PBKDF2, scrypt, Argon2).

```typescript
const key =
    keyBuffer ??
    crypto
        .createHash("sha256")
        .update(keystr ?? "")
        .digest();
```

**Risk:** A single SHA-256 iteration provides virtually no protection against brute-force attacks. GPU-based attacks can attempt billions of SHA-256 hashes per second.

**Impact:** Master seed encryption can be broken offline if database file is compromised. Full wallet compromise.

**Recommendation:** Replace with PBKDF2 with minimum 100,000 iterations, or preferably scrypt/Argon2id:
```typescript
// Example fix using PBKDF2
const salt = crypto.randomBytes(32); // Store with encrypted data
const key = crypto.pbkdf2Sync(keystr, salt, 310000, 32, 'sha256');
```

---

### C-02: Empty Password Fallback in Key Derivation

**File:** `web/src/lib/tokenpass/crypt.ts:20`

**Issue:** When no password is provided, the code defaults to hashing an empty string.

```typescript
.update(keystr ?? "")
```

**Risk:** If password validation is bypassed anywhere in the call chain, encryption defaults to a predictable key derived from empty string.

**Impact:** Potential full seed compromise with known key.

**Recommendation:** Throw an error when keystr is undefined/empty and keyBuffer is not provided. Never allow empty password encryption.

---

## High Severity Findings

### H-01: Timing Attack Vulnerability in Token Validation

**File:** `web/src/app/api/sign/route.ts:32` and `web/src/app/api/encrypt/route.ts:32`

**Issue:** Access token comparison uses JavaScript string equality (`!==`) instead of constant-time comparison.

```typescript
if (!state?.accessToken || state.accessToken !== accessToken) {
```

**Risk:** Timing side-channel allows attackers to brute-force access tokens one character at a time.

**Impact:** Access token bypass, unauthorized signing/encryption operations.

**Recommendation:** Use `crypto.timingSafeEqual()`:
```typescript
import { timingSafeEqual } from 'node:crypto';

const tokensMatch = state?.accessToken && 
    timingSafeEqual(Buffer.from(state.accessToken), Buffer.from(accessToken));
```

---

### H-02: No Rate Limiting on Authentication Endpoints

**Files:** 
- `web/src/app/api/login/route.ts`
- `web/src/app/api/auth/route.ts`
- `web/src/app/api/register/route.ts`
- `web/src/app/api/export/route.ts`

**Issue:** No rate limiting on password-based endpoints.

**Risk:** Unlimited brute-force attempts against wallet passwords.

**Impact:** Given the weak KDF (C-01), online brute-force becomes viable.

**Recommendation:** Implement rate limiting (e.g., 5 attempts per minute) with exponential backoff. Consider account lockout after repeated failures.

---

### H-03: Profile Endpoint Lacks Authentication

**File:** `web/src/app/api/profile/route.ts:9-21`

**Issue:** POST endpoint allows unauthenticated profile modification.

```typescript
export async function POST(request: NextRequest) {
    const body = await request.json();
    // No authentication check
    let profile = await State.findOne({ host: "global" });
    // ...
    const updated = { ...profile, ...body, host: "global" };
    await State.update(updated);
```

**Risk:** Any caller can modify user profile data including displayName, paymail, logo.

**Impact:** Identity spoofing, phishing attacks using modified profile data.

**Recommendation:** Require valid access token with `write_profile` scope.

---

### H-04: Seed Material in Memory Without Protection

**File:** `web/src/lib/tokenpass/key.ts:33-46`

**Issue:** Decrypted seed is stored in class instance memory with no automatic clearing.

```typescript
private seed: SeedData | null = null;

setSeed(s: SeedData | null): void {
    this.seed = s;
}
```

**Risk:** Seed remains in memory indefinitely until explicit logout. Memory dumps, heap inspection, or process debugging exposes seed.

**Impact:** Full wallet compromise via memory access.

**Recommendation:** Implement automatic seed clearing after inactivity timeout. Consider using secure memory allocation where available.

---

## Medium Severity Findings

### M-01: Debug Endpoint Exposes Sensitive Information

**File:** `web/src/app/api/debug/route.ts:1-37`

**Issue:** Debug endpoint reveals database internals without authentication.

```typescript
export async function GET() {
    // ...
    db.findOne({}, (findErr, doc) => {
        resolve(NextResponse.json({
            filename,
            count,
            hasDoc: !!doc,
            docKeys: doc ? Object.keys(doc) : []
        }));
    });
```

**Risk:** Information disclosure about database structure and existence of seed.

**Impact:** Reconnaissance value for attackers. Should not exist in production.

**Recommendation:** Remove debug endpoint or restrict to development environment only.

---

### M-02: Missing Scope Validation on Protected Endpoints

**Files:** `web/src/app/api/sign/route.ts`, `web/src/app/api/encrypt/route.ts`

**Issue:** Access token scopes are stored but never validated.

```typescript
// Scopes are stored in state.scopes but never checked
const state = await State.findOne({ accessToken });
// Missing: if (!state.scopes.includes('sign')) { return 401 }
```

**Risk:** Tokens meant for read-only operations can be used for signing.

**Impact:** Principle of least privilege violated. Over-permissioned tokens.

**Recommendation:** Check `state.scopes` includes required scope (`sign` for /sign, `encrypt` for /encrypt).

---

### M-03: Sensitive Data Logging

**File:** `web/src/lib/tokenpass/state.ts:105`

**Issue:** Access token logged to console.

```typescript
console.log("UPDATED", { err, accessToken: doc?.accessToken });
```

**Risk:** Tokens appear in server logs, potentially accessible to operators or log aggregation systems.

**Impact:** Token theft via log access.

**Recommendation:** Remove logging of sensitive authentication material.

---

### M-04: AES-CBC Without Authentication (MAC)

**File:** `web/src/lib/tokenpass/crypt.ts`

**Issue:** AES-256-CBC encryption without HMAC/authentication tag.

**Risk:** Encrypted data vulnerable to bit-flipping attacks and padding oracle attacks.

**Impact:** Potential plaintext recovery or data manipulation.

**Recommendation:** Use AES-256-GCM (authenticated encryption) or add HMAC-SHA256 over ciphertext.

---

### M-05: Status Endpoint Exposes Key/State Data

**File:** `web/src/app/api/status/route.ts:4-9`

**Issue:** Returns all keys and states when wallet is unlocked.

```typescript
if (Key.getSeed()) {
    const keys = (await Key.all()) || [];
    const states = (await State.all()) || [];
    return NextResponse.json({ seed: true, unlocked: true, keys, states });
}
```

**Risk:** All access tokens and key metadata exposed.

**Impact:** Information disclosure, potential token theft.

**Recommendation:** Require authentication. Sanitize response to exclude accessToken values.

---

## Low Severity / Informational

### L-01: Console.log Statements in Production Code

**Files:**
- `web/src/lib/tokenpass/key.ts:77`
- `web/src/lib/tokenpass/state.ts:105`
- `web/src/app/api/status/route.ts:11`

**Issue:** Debug logging present in production code.

**Recommendation:** Remove or gate behind debug flag.

---

### L-02: Missing Input Validation

**Files:** Multiple API routes

**Issue:** No validation of input types, lengths, or formats. Examples:
- `message` in /sign can be any type
- `encoding` not validated against allowed values
- `host` not validated for format
- `scopes` string not sanitized

**Recommendation:** Add schema validation (e.g., zod) for all API inputs.

---

### L-03: No CSRF Protection

**Files:** All POST API routes

**Issue:** No CSRF token validation on state-changing operations.

**Risk:** Cross-site request forgery attacks (mitigated if API is same-origin only).

**Recommendation:** Implement CSRF tokens for browser-based API calls.

---

### L-04: Export Endpoint Returns Seed Material

**File:** `web/src/app/api/export/route.ts:13-16`

**Issue:** Raw seed hex exported over HTTP.

```typescript
return NextResponse.json({ seed: result.hex, mnemonic: result.mnemonic });
```

**Risk:** Seed transmitted over network (even localhost). Log exposure, network interception.

**Impact:** Full wallet compromise if intercepted.

**Recommendation:** Ensure HTTPS only. Consider alternative export methods (file download, QR display).

---

## Positive Findings

1. **Proper IV Generation:** Random IV generated for each encryption (`crypto.randomBytes(16)`)
2. **Standard BIP39/BIP44 Implementation:** Key derivation follows standards
3. **Token Expiration:** Access tokens have configurable expiration
4. **Seed Encryption at Rest:** Master seed is encrypted in database
5. **Signature Verification:** BSM signature verification implemented correctly

---

## Remediation Priority

| Priority | Finding | Effort |
|----------|---------|--------|
| 1 | C-01: Weak KDF | Medium |
| 2 | C-02: Empty password fallback | Low |
| 3 | H-01: Timing attack | Low |
| 4 | H-02: Rate limiting | Medium |
| 5 | H-03: Profile auth | Low |
| 6 | M-01: Debug endpoint | Low |
| 7 | M-02: Scope validation | Low |
| 8 | M-03: Token logging | Low |
| 9 | M-04: AES-GCM upgrade | Medium |
| 10 | Remaining items | Varies |

---

## Appendix: Files Reviewed

- `web/src/lib/tokenpass/crypt.ts`
- `web/src/lib/tokenpass/key.ts`
- `web/src/lib/tokenpass/seed.ts`
- `web/src/lib/tokenpass/state.ts`
- `web/src/lib/tokenpass/server.ts`
- `web/src/lib/tokenpass/types.ts`
- `web/src/lib/tokenpass/wallet/index.ts`
- `web/src/lib/tokenpass/wallet/bitcore-message.ts`
- `web/src/lib/tokenpass/utils/mnemonic.ts`
- `web/src/app/api/login/route.ts`
- `web/src/app/api/logout/route.ts`
- `web/src/app/api/register/route.ts`
- `web/src/app/api/auth/route.ts`
- `web/src/app/api/auth/icon/route.ts`
- `web/src/app/api/sign/route.ts`
- `web/src/app/api/encrypt/route.ts`
- `web/src/app/api/profile/route.ts`
- `web/src/app/api/export/route.ts`
- `web/src/app/api/status/route.ts`
- `web/src/app/api/debug/route.ts`
