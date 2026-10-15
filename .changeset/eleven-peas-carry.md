---
'@mastra/factory': patch
---

Fixed several Factory `/web/*` routes answering without a signed-in user. `/web/*` routes now require authentication, except the signed GitHub and GitLab webhooks. Sign-in and connect flows and the Slack connect page also stay public. Each request is authenticated once instead of up to three times, and `/auth/me` now returns the renewed session cookie. Projects built with an older `mastra` CLI keep organization selection and message authors working.
