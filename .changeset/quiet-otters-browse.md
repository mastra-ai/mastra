---
'mastracode': patch
---

Fixed Stagehand browser actions (observe, act, extract) failing with "Bad Request" when signed in with a ChatGPT/Codex account and no browser model is configured; the fallback model is now gpt-5.5, which the Codex endpoint accepts. The `/browser` setup summary and `/browser status` (also available as `/browser info`) now show which Stagehand model is in use and why (configured, Codex login fallback, or Stagehand default), reporting the model the running browser actually launched with. Fixed `/browser status` wrongly reporting "Pending changes (not yet applied)" whenever a profile, executable path, or Stagehand model was configured.
