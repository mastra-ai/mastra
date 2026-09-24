---
'@mastra/code-sdk': patch
'mastracode': patch
---

Fixed Stagehand browser actions (observe, act, extract) failing with "Bad Request" when signed in with a ChatGPT/Codex account and no browser model is configured; the fallback model is now gpt-5.5, which the Codex endpoint accepts. Added `resolveStagehandModel()` to `@mastra/code-sdk` so callers can see which model Stagehand will use and why (configured, Codex login fallback, or Stagehand default), and surfaced it in the `/browser` setup summary and `/browser status` (also available as `/browser info`). Fixed `/browser status` wrongly reporting "Pending changes (not yet applied)" whenever a profile, executable path, or Stagehand model was configured.
