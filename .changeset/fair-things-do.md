---
'@mastra/playground-ui': patch
---

Improved the trace span tree: each span now shows a small badge with its type icon, nested spans connect with rounded elbow lines, names read as "kind › name" (for example `agent run › chef-agent`) in slightly larger text, and durations use the regular font. Also removed the extra space above the span type legend.
