---
'@mastra/braintrust': patch
---

Fixed Braintrust cost for model calls with a provider-reported price, such as OpenRouter and Vercel AI Gateway. Braintrust now shows the amount the provider charged, instead of its own price list estimate or no cost at all.
