---
"@mastra/auth-auth0": major
---

# Breaking Change: Auth0 Provider Security & Stability Improvements

This release introduces **three major breaking changes** to the Auth0 authentication provider. These updates make token verification safer, prevent server crashes, and ensure proper authorization checks.

---

## 🔥 1. Added Robust Error Handling in `authenticateToken()`
**File:** `auth0/src/index.ts`

### Before
```ts
async authenticateToken(token: string): Promise<Auth0User | null> {
  const JWKS = createRemoteJWKSet(new URL(`https://${this.domain}/.well-known/jwks.json`));

  const { payload } = await jwtVerify(token, JWKS, {
    issuer: `https://${this.domain}/`,
    audience: this.audience,
  });

  return payload;
}
````

### After

```ts
async authenticateToken(token: string): Promise<Auth0User | null> {
  try {
    const JWKS = createRemoteJWKSet(
      new URL(`https://${this.domain}/.well-known/jwks.json`)
    );

    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://${this.domain}/`,
      audience: this.audience,
    });

    return payload;
  } catch (err) {
    return null;
  }
}
```

### Why this matters

* Prevents server crashes from unhandled JWT verification errors.
* Ensures authentication failures fail safely instead of throwing.

---

## 🔥 2. Added Validation for Empty or Invalid Token Input

**File:** `auth0/src/index.ts`

### Before

```ts
async authenticateToken(token: string): Promise<Auth0User | null> {
  const JWKS = createRemoteJWKSet(new URL(`https://${this.domain}/.well-known/jwks.json`));

  const { payload } = await jwtVerify(token, JWKS, {
    issuer: `https://${this.domain}/`,
    audience: this.audience,
  });

  return payload;
}
```

### After

```ts
async authenticateToken(token: string): Promise<Auth0User | null> {
  if (!token || typeof token !== "string") {
    return null;
  }

  try {
    const JWKS = createRemoteJWKSet(
      new URL(`https://${this.domain}/.well-known/jwks.json`)
    );

    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://${this.domain}/`,
      audience: this.audience,
    });

    return payload;
  } catch {
    return null;
  }
}
```

### Why this matters

* Prevents crashes when token is `null`, `undefined`, or empty.
* Makes token verification predictable and safe.

---

## 🔥 3. Improved `authorizeUser()` With Real Security Checks

**File:** `auth0/src/index.ts`

### Before

```ts
async authorizeUser(user: Auth0User) {
  return !!user;
}
```

### After

```ts
async authorizeUser(user: Auth0User): Promise<boolean> {
  if (!user || !user.sub) return false;

  if (user.exp && user.exp * 1000 < Date.now()) {
    return false;
  }

  return true;
}
```

### Why this matters

* Prevents invalid payloads like `{}` or `{ exp: 0 }` from being accepted.
* Enforces a baseline standard:

  * `sub` (user ID) must exist.
  * Token must not be expired.
* Improves reliability and security across all Auth0-based flows.

---

## ✅ Summary of Breaking Changes

* `authenticateToken()` now **fails safely** instead of throwing.
* Empty or invalid tokens are now **rejected early**.
* `authorizeUser()` now performs **meaningful security checks**.

These changes improve stability, prevent runtime crashes, and enforce safer authentication & authorization behavior throughout the system.

```
