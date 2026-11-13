---
'@mastra/client-js': patch
---

Fixed client tools sending a mapped validation error to the model. When a client tool's own validation rejects its arguments or output, the client no longer runs the tool's `toModelOutput` on the error. The model receives the validation error, marked as an error result, so it can retry instead of reading an empty result such as `{}`. The error sent to the model leaves out the raw arguments or output the full error quotes. A result that merely has `error: true` and `validationErrors` fields is still mapped by `toModelOutput`. Fixes #30211.
