---
'@mastra/code-sdk': minor
---

Added provider-aware observational memory defaults, so a controller started without a stored OM choice observes and reflects with the cheap model of a provider you can actually reach instead of the built-in Gemini default.

The selection helpers are exported from the new `@mastra/code-sdk/onboarding` entry point if you build your own surface on the SDK:

```ts
import { resolveProviderOMDefault, selectPreferredOMPack } from '@mastra/code-sdk/onboarding';

// OM pack for one provider — falls back to the model you pass for providers without one
resolveProviderOMDefault('openai-codex').modelId;

// Best OM pack across everything the user can reach, preferring a given provider
selectPreferredOMPack({ anthropic: 'oauth', google: 'apikey' }, 'anthropic')?.modelId;
```
