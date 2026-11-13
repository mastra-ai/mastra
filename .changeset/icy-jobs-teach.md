---
'@mastra/client-js': patch
---

Fixed client tools sending a mapped validation error to the model. When a client tool's arguments fail validation, the client no longer runs the tool's `toModelOutput` on the error, so the model receives the validation error unchanged, marked as an error result, and can retry instead of an empty result such as `{}`. Fixes #30211.
