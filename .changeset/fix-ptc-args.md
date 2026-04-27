---
"@mastra/core": patch
---

fix(tools): preserve args for programmatic tool calls when merging synthetic tool-call

Fixes an issue where programmatic tool calls (PTC) received empty `{}` arguments during streaming.

When a synthetic tool-call was created with empty args, the real tool-call event (containing actual args) was ignored. This change ensures that args from the real tool-call are merged into the synthetic one when missing.