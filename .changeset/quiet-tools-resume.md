---
'@mastra/core': patch
---

Fixed `resumeStream` ignoring the `requestContext` and `delegation` you pass when a supervisor run is resumed in the same process that suspended it. The resumed delegation now calls the `onDelegationStart` hook from the resume call, and sub-agent tools see the resume call's `requestContext`. Fixes [#25960](https://github.com/mastra-ai/mastra/issues/25960).
