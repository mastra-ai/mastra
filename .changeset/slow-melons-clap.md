---
'@mastra/connect': patch
---

Fixed Slack channel connections breaking after token rotation. channels() now builds the Slack provider with a token resolver that fetches a fresh App Configuration access token from the Mastra platform before each manifest call, instead of rotating the platform's single-use refresh token locally. This prevents the "Slack refresh token is invalid" error caused by the platform's credential vendor and the provider both rotating the same token.
