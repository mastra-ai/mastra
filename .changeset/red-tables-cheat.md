---
"@mastra/auth-auth0": major
---

This change introduces **three major breaking changes** to the Auth0 authentication provider. These updates make token verification safer, prevent server crashes, and ensure proper authorization checks.

- `authenticateToken()` now fails safely instead of throwing
- Empty or invalid tokens are now rejected early
- `authorizeUser()` now performs meaningful security checks

These changes improve stability, prevent runtime crashes, and enforce safer authentication & authorization behavior throughout the system.
