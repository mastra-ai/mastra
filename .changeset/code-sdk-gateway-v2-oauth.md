---
'@mastra/code-sdk': patch
---

Fixed `mastra/anthropic/*` and `mastra/openai/*` models failing on every turn with "Invalid API key format" when a Mastra Gateway organization key (`msk-gateway-...` or `mskv2_...`) is set and you are signed in with Claude or Codex OAuth. The request now goes through the Mastra Gateway with the gateway key and is billed there, and web search follows the same route. Project keys (`msk_...`) keep using your Claude or Codex sign-in through the gateway as before.

Errors from the Mastra Gateway itself are now worded for the gateway. A 402 says the gateway refused the request because of credits or a budget and shows the gateway's code, instead of "Usage quota exhausted for this provider account". A 403 with a gateway code such as `no_eligible_route` or `model_not_allowed` says the gateway does not allow this model or feature for your key.
