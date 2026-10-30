---
'@mastra/factory': patch
---

Fixed several Factory `/web/*` routes answering without a signed-in user. `/web/*` routes now require authentication, except the signed GitHub and GitLab webhooks. Sign-in and connect flows and the Slack connect page also stay public. Each request is authenticated once instead of up to three times, and `/auth/me` now returns the renewed session cookie. Projects built with an older `mastra` CLI keep organization selection and message authors working.

If a script or integration called these routes without credentials, send the Factory session cookie or a bearer token. Unauthenticated requests now get a `401`:

```bash
# Before: answered without credentials
curl https://my-factory.example.com/web/config/features

# After: send credentials
curl -H "Authorization: Bearer $FACTORY_TOKEN" https://my-factory.example.com/web/config/features
```
