---
'@mastra/core': patch
---

Fixed Vercel AI Gateway failing when using the model router string format (e.g. `vercel/openai/gpt-oss-120b`). The provider registry was overriding `createGateway`'s base URL with an incorrect value, causing API requests to hit the wrong endpoint. Removed the URL override so the AI SDK uses its own correct default. Closes #13280.
