---
'@mastra/code-sdk': patch
---

Added `resolveStagehandModel()` so callers can see which model Stagehand will use and why (configured, Codex login fallback, or Stagehand default). Changed the Codex OAuth fallback model for Stagehand from gpt-5.4-mini (rejected by the Codex endpoint) to gpt-5.5, and kept the full `BrowserSettings` shape (profile, executable path, model, scope) plus the resolved model in the session's active-browser state.
