---
'@mastra/connect': patch
---

Fixed Slack channel connections failing with "Slack refresh token is invalid" when the platform credential includes a separate refresh token. `channels()` now reads the oauth2 credential's `refreshToken` field (falling back to `accessToken`) when building the Slack provider, so the App Configuration refresh token reaches `SlackProvider` instead of the short-lived access token.
