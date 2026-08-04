---
'@mastra/memory': patch
---

preserve markdown links when optimizing observations for context

`optimizeObservationsForContext` stripped every `[...]` group, which removed
the label from any markdown link an observation contained and left a bare,
unlabelled URL in the agent-facing context. Link labels are now preserved.
Semantic tag stripping and collapsed item markers are unchanged.
