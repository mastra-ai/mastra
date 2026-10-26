---
'@mastra/core': patch
'@mastra/observability': patch
---

You can now filter and group spans by their parent or root entity, for example to count tool calls per agent or per workflow. The root is the top span recorded in the current process, so for a trace continued from another service it is the local root, not the distributed trace's root. Durable agents keep this lineage on spans that end in a later step. Spans stored before this change have no parent or root entity.
