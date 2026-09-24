---
'@mastra/code-sdk': patch
---

Added `resolveStagehandModel()` so callers can see which model Stagehand will use and why (configured, Codex login fallback, or Stagehand default). Changed the Codex OAuth fallback model for Stagehand from gpt-5.4-mini (rejected by the Codex endpoint) to gpt-5.5. The session's active-browser state now keeps the full `BrowserSettings` shape (profile, executable path, model, scope) plus the resolved model, while stripping the Browserbase API key via `toActiveBrowserSettings()` so credentials never land in session state.

```ts
import { loadSettings, resolveStagehandModel } from '@mastra/code-sdk/onboarding/settings';

const { modelName, source } = resolveStagehandModel(loadSettings().browser);
// e.g. { modelName: 'openai/gpt-5.5', source: 'codex-oauth' }
```
