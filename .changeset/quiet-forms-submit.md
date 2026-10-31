---
'@mastra/playground-ui': patch
---

Fixed Studio forms that would not submit when left blank after the zod 4 upgrade. Resuming a suspended step with no resume schema, and running a workflow that has a state schema but no input schema, failed with "Required" instead of submitting.
