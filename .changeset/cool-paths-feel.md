---
'@mastra/braintrust': patch
---

Fixed a run started with `tracingOptions.nestUnderParent` appearing as a second top-level span in Braintrust. It now appears as a child of its parent span, also when another process exported the parent.
