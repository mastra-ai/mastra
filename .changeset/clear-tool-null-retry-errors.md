---
'@mastra/core': patch
---

Fixed misleading tool input validation errors. When a model sent `null` for optional fields and the call still failed for another reason, the error listed the `null` fields as problems and hid the real cause. Errors now report only the issues that remain after `null` values are removed, so models can fix the actual problem on the next attempt.
