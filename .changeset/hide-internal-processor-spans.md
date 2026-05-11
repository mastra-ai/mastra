---
"@mastra/core": patch
---

Hide internal spans from Mastra-owned processors in exported traces. The `PROCESSOR_RUN` span still appears, but the agent, model, and tool spans that processors create under the hood are now marked internal and filtered out by default.

Affects the moderation, PII detector, language detector, prompt-injection detector, system-prompt scrubber, and structured-output processors.

To inspect the internals (e.g. for debugging a Mastra-owned processor's behavior), set `includeInternalSpans: true` on your Observability config and the full subtree will be exported.
