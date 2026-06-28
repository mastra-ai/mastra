---
'mastracode': minor
---

Added optional WorkOS AuthKit authentication to the MastraCode web UI. When the WORKOS_API_KEY and WORKOS_CLIENT_ID environment variables are set, every route is protected: unauthenticated visitors are redirected to the WorkOS hosted login, signed-in users get an encrypted session, expired sessions are redirected back to login, and the sidebar shows the signed-in email with a Sign out button. When the variables are absent, the server and UI behave exactly as before with no authentication.

Enabling it looks like:

```bash
WORKOS_API_KEY=sk_xxxxxxxx
WORKOS_CLIENT_ID=client_xxxxxxxx
# optional (recommended in prod): 32+ char secret to seal session cookies
WORKOS_COOKIE_PASSWORD=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```
