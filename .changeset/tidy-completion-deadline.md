---
'@mastra/core': patch
---

Fix network completion scoring to honor its timeout as a hard deadline. Previously `runCompletionScorers` awaited every scorer to settle after the deadline, so a slow scorer could return a late passing verdict with `complete: true`, a never-settling scorer could hang the call indefinitely, and the default timeout timer was never cleared. Parallel and sequential scoring now race each scorer against a single shared deadline, return promptly when it elapses, preserve the evidence of scorers that already finished, mark unfinished checks as errored failures, prevent late results from changing the returned verdict, and clear the timer on completion. Non-Error scorer rejections (`null`, `undefined`, strings, plain objects, and objects with throwing `message` getters) are now converted into explicit scorer failures instead of crashing the error handler or losing their reason. Fixes #23449.
