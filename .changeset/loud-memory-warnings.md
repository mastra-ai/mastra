---
'@mastra/core': patch
---

The warning "No memory is configured but resourceId and threadId were passed in args" is shown again for Mastra Gateway models when the Gateway does not keep memory for your key, such as an organization key. It stays hidden when the Gateway manages memory. The check runs in the background and does not delay the run.
