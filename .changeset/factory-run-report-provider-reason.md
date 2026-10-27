---
'@mastra/factory': patch
---

Failed run reports now quote the model provider's own reason for any provider failure, not only usage limits. For example, a report says `prompt is too long: 210345 tokens > 200000 maximum` instead of `Bad Request`.

A run that fails because the provider rejected its credentials is now reported as a credentials problem even when only the response body says so, for example a 400 whose body code is `invalid_api_key`.
