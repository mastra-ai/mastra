---
'@mastra/code-sdk': minor
---

Added provider-aware observational memory defaults, so a controller started without a stored OM choice observes and reflects with the cheap model of a provider you can actually reach instead of the built-in Gemini default.

The helpers behind it are exported if you build your own surface on the SDK:

```ts
import { hasExplicitOMConfiguration } from '@mastra/code-sdk/onboarding/om-settings';
import { selectPreferredOMPack } from '@mastra/code-sdk/onboarding/packs';

// Best OM pack across everything the user can reach, preferring a given provider
selectPreferredOMPack({ anthropic: 'oauth', google: 'apikey' }, 'anthropic')?.modelId;

// True once the user picked an OM model or pack themselves — never seed over it
hasExplicitOMConfiguration(settings);
```
