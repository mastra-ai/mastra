---
'@mastra/core': patch
---

Fixed DurableAgent streams with `closeOnSuspend: true` closing before the suspended run was saved. Approving a tool call right after the stream ends now works from any process, instead of sometimes failing with "This workflow run was not suspended". Fixes #26454.
