---
'@mastra/braintrust': patch
---

Fixed tool results missing from the Braintrust Thread view. The exporter now reads the tool call ID from the span attributes to pair each tool result with its call.
