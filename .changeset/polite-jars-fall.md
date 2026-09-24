---
'@mastra/core': minor
---

Invalid tool-call IDs on Anthropic models are now rewritten in the outbound request, so they no longer reach Anthropic and no longer require a failed call to recover. Persisted history keeps its original IDs. The rule's reactive repair (`errorPatterns` and `fix`) stays as the fallback for Claude served through a provider the preemptive check doesn't recognize, such as Vertex-hosted Claude, and for placements outside the agent's prompt path.
