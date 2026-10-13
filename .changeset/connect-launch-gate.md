---
'@mastra/connect': patch
---

Gate end-user connect flows behind a launch route. `POST /connect/:provider/sessions` now returns a `launchUrl` instead of the provider's authorization link; the new `GET /connect/connections/:id/launch` route verifies the caller owns the pending session before 302-redirecting into the provider's OAuth flow. The vendor link is a bearer capability — anyone who opens it can bind their account to the pending connection — so it now stays server-side, and a forwarded or leaked launch URL returns 404 for anyone but the session owner. The hosted connect page navigates its popup through the launch route automatically.
