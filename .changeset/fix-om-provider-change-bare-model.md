---
'@mastra/memory': patch
---

Fix spurious provider-change activations when persisted assistant messages carry a bare `modelId` (no provider). Older persisted messages may have `metadata: { provider: null, modelId: 'gpt-5.4' }` which formatted to the bare string `'gpt-5.4'`, while the current actor model formats as `'provider/modelId'`. The resulting mismatch triggered a false `provider_change` activation. Provider-change detection now falls back to comparing the `modelId` portion when either side lacks a `provider/` prefix.
