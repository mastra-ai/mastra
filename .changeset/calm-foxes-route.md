---
'@mastra/code-sdk': patch
---

Changed how Stagehand picks its model when `browser.stagehand.model` is not set: it now reuses the chat model captured at browser launch when Stagehand can route it (any `openai/*` model over an OpenAI Codex login, or a Stagehand provider whose API key is in the environment), then falls back to the OpenAI Codex default model, then to Stagehand's own default. Any `openai/*` model — configured or inferred — now goes through the Codex endpoint when you are signed in with Codex OAuth, with the same `-codex` model-id remaps the chat agents apply, so a Codex-only user no longer needs a separate `OPENAI_API_KEY` for browser automation.

```ts
import { resolveStagehandModel } from '@mastra/code-sdk/onboarding/settings';

const { modelName, source, viaCodexOAuth } = resolveStagehandModel(settings.browser, {
  chatModelId: session.model.get(),
});
// e.g. { modelName: 'openai/gpt-5.5', source: 'chat-model', viaCodexOAuth: true }
```
