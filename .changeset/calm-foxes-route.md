---
'@mastra/code-sdk': patch
---

**Stagehand model selection now follows your chat setup instead of a hardcoded fallback.**

- Added `resolveStagehandModel()` to report which model Stagehand will use and why. It resolves, in order: `browser.stagehand.model` (`settings`), the chat model captured at browser launch when Stagehand can route it (`chat-model`), the OpenAI Codex default model when you are signed in with Codex (`codex-oauth`), then Stagehand's own default (`stagehand-default`).
- Any `openai/*` model, configured or inferred, now goes through the Codex endpoint when your OpenAI login is Codex OAuth, with the same `-codex` model-id remaps the chat agents apply. Codex-only users no longer need a separate `OPENAI_API_KEY` for browser automation.
- Dotted Anthropic ids such as `anthropic/claude-opus-4.6` are normalized before being handed to Stagehand, matching the chat agents.
- The session's active-browser state keeps the full `BrowserSettings` shape plus the resolved model, while `toActiveBrowserSettings()` strips the Browserbase API key so credentials never land in session state.

Removed the exported `STAGEHAND_CODEX_FALLBACK_MODEL` constant. Use `resolveStagehandModel()` instead:

```ts
import { resolveStagehandModel } from '@mastra/code-sdk/onboarding/settings';

// Before
// import { STAGEHAND_CODEX_FALLBACK_MODEL } from '@mastra/code-sdk/onboarding/settings';

// After
const { modelName, source, viaCodexOAuth } = resolveStagehandModel(settings.browser, {
  chatModelId: session.model.get(),
});
// e.g. { modelName: 'anthropic/claude-sonnet-4-5', source: 'chat-model', viaCodexOAuth: false }
```
