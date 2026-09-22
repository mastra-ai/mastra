---
'@mastra/server': patch
---

Fixed `POST /auth/logout` reporting success when it could not log anything out. The route previously returned `200 { success: true }` unconditionally — even with no auth provider configured — while `POST /auth/refresh` returned 404 for the equivalent missing capability. Clients had no way to tell a real logout from a no-op.

Logout now returns `404 "Logout not configured"` when the provider can neither destroy a session, clear session cookies, nor supply an SSO logout URL.

**What still returns 200**

- Providers supporting any one of those capabilities, including SSO-only providers that implement just `getLogoutUrl`
- Logout with no active session, since the desired end state is already met

**Before / after**

Clients that assumed logout always succeeded need to handle the 404:

```ts
// Before: always resolved, even when logout was impossible
await fetch('/api/auth/logout', { method: 'POST' });

// After: 404 means the server has no way to log the user out
const res = await fetch('/api/auth/logout', { method: 'POST' });

if (res.status === 404) {
  // No logout capability configured — clear local state yourself
  clearLocalSession();
} else if (!res.ok) {
  throw new Error(`Logout failed: ${res.status}`);
}
```

If you see a 404 unexpectedly, add `destroySession`, `getClearSessionHeaders`, or `getLogoutUrl` to your auth provider.
