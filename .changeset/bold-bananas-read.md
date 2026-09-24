---
'@mastra/code-sdk': patch
---

Fixed Stagehand browser actions (observe, act, extract) failing with "Bad Request" when signed in with a ChatGPT/Codex account and no browser model is configured. The fallback model is now gpt-5.5, which the Codex endpoint accepts.
