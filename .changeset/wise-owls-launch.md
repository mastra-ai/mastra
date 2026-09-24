---
'mastracode': patch
---

**Fixed Stagehand browser automation for OpenAI Codex users and made the browser model visible.**

- Stagehand actions (observe, act, extract) no longer fail with "Bad Request" when signed in with a ChatGPT/Codex account and no browser model is configured.
- A model chosen with `/browser set model openai/...` now runs through your Codex login instead of requiring a separate `OPENAI_API_KEY`.
- With no browser model configured, Stagehand reuses the chat model active at launch when it can route it, then falls back to the Codex default, then to Stagehand's default.
- The `/browser` setup summary and `/browser status` show which model is in use and why (configured, current chat model, Codex login default, or Stagehand default), reporting the model the running browser actually launched with.
- Fixed `/browser status` wrongly reporting "Pending changes (not yet applied)" whenever a profile, executable path, or Stagehand model was configured.
- The Browserbase API key is no longer stored in session state.

```
/browser info    # alias for /browser status
```
