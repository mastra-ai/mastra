---
'@mastra/factory': patch
---

Fixed several Factory `/web/*` routes answering without a signed-in user. All `/web/*` routes now require authentication; only sign-in and connect flows, signed webhooks, and the Slack connect page stay public. Each request is authenticated once instead of up to three times, and `/auth/me` now returns the renewed session cookie.
