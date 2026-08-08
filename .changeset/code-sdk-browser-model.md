---
'@mastra/code-sdk': patch
---

Added a `model` option to Stagehand browser settings, so browser automation can run on a chosen provider instead of a fixed default:

```ts
import { createBrowserFromSettings } from '@mastra/code-sdk/onboarding/settings';

const browser = await createBrowserFromSettings({
  enabled: true,
  provider: 'stagehand',
  headless: true,
  stagehand: { env: 'LOCAL', model: 'anthropic/claude-sonnet-4-5' },
});
```

The model must be provider-qualified as `<provider>/<model>`. Values Stagehand cannot resolve, such as a bare `gpt-4.1`, are ignored so the browser still starts.
