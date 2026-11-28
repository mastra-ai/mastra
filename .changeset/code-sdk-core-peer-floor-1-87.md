---
'@mastra/code-sdk': patch
---

Raised the @mastra/core peer floor to 1.87.0, the first release with the `resumeLatestThread` session option. With an older core, `createMastraCode({ resumeLatestThread: false })` would still resume the latest thread.
