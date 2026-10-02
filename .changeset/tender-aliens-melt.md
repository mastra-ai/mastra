---
'@mastra/core': minor
---

Added the per-provider object form to the `ObservationalMemoryActivationTTL` type, so `activateAfterIdle` accepts values like `{ default: 'auto', anthropic: '1h' }`. New `ObservationalMemoryActivationTTLValue` and `ObservationalMemoryActivationTTLByProvider` types are exported.
