---
'@mastra/playground-ui': patch
---

The tripwire notice no longer imports the code editor up front: its metadata editor loads when the details are opened. An app whose chat view uses no other code editor drops it from its initial bundle.
