---
'@mastra/code-sdk': minor
---

Added `resolveProviderOMDefault` to `@mastra/code-sdk/onboarding/packs`, which returns the small, cheap observational memory model for a provider, or the model you pass in when that provider has none.

The built-in OM packs are now a single table, so the list offered during onboarding and the per-provider default can no longer drift apart.

```ts
import { resolveProviderOMDefault } from '@mastra/code-sdk/onboarding/packs';

resolveProviderOMDefault('anthropic').modelId; // 'anthropic/claude-haiku-4-5'
resolveProviderOMDefault('openai-codex').modelId; // 'openai/gpt-5.4-mini'
resolveProviderOMDefault('xai', 'xai/grok-4.5').modelId; // 'xai/grok-4.5'
```
