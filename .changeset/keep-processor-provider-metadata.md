---
'@mastra/core': patch
---

Fixed processor workflows that use `ProcessorStepOutputSchema` dropping `providerMetadata` in the `outputStep` phase. `processOutputStep` in those workflows now receives the provider metadata, such as Bedrock guardrail traces.
