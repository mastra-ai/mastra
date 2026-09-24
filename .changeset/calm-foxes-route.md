---
'@mastra/code-sdk': patch
---

**Stagehand model selection now follows your chat setup instead of a hardcoded fallback.**

- Added `resolveStagehandModel()` to report which model Stagehand will use and why. It resolves, in order: `browser.stagehand.model` (`settings`), the chat model captured at browser launch when Stagehand can route it (`chat-model`), the OpenAI Codex default model when you are signed in with Codex (`codex-oauth`), then Stagehand's own default (`stagehand-default`).
- Any `openai/*` model, configured or inferred, now goes through the Codex endpoint when your OpenAI login is Codex OAuth, with the same `-codex` model-id remaps the chat agents apply. Codex-only users no longer need a separate `OPENAI_API_KEY` for browser automation.
- Dotted Anthropic ids such as `anthropic/claude-opus-4.6` are normalized before being handed to Stagehand, matching the chat agents.
- Fixed the Browserbase API key being saved in session state; the active-browser snapshot is now credential-free and records which model the browser launched with.

```ts
import { resolveStagehandModel } from '@mastra/code-sdk/onboarding/settings';

const { modelName, source, viaCodexOAuth } = resolveStagehandModel(settings.browser, {
  chatModelId: session.model.get(),
});
// e.g. { modelName: 'anthropic/claude-sonnet-4-5', source: 'chat-model', viaCodexOAuth: false }
```
