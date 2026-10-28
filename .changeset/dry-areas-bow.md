---
'mastra': minor
'create-mastra': minor
---

Added Mastra Gateway as a model provider in `create-mastra`. Pick **Mastra Gateway** to call every model with one key: the CLI signs you in to Mastra in the browser, creates a Gateway API key, writes it to `.env` as `MASTRA_GATEWAY_API_KEY`, and points the agent at `mastra/` models. When your balance is $0, it offers to open the Mastra dashboard to add credits, and picks up the new balance when you come back.

Added `mastra gateway credits` to show your Gateway balance and add credits later.

```bash
npx create-mastra@latest my-app --llm mastra
mastra gateway credits
```
