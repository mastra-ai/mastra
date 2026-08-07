---
'@mastra/factory': patch
---

Fixed the factory auth gate returning 401 for the SPA sign-in flow. The gate now lets Mastra core's public auth routes (`/api/auth/capabilities`, `/api/auth/me`, `/api/auth/sso/login`, `/api/auth/sso/callback`, `/api/auth/logout`, `/api/auth/refresh`, `/api/auth/credentials/sign-in`, `/api/auth/credentials/sign-up`) reach their handlers before a session exists. Previously the SPA could not fetch its capabilities on load and stayed stuck at "unauthorized".
