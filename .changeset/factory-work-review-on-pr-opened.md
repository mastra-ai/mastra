---
'@mastra/factory': patch
---

Fixed Factory Work cards staying in Building after their build opens a pull request. The Work card now moves to Review when the pull request opens, instead of depending on the build agent to move it. Fixes [#25346](https://github.com/mastra-ai/mastra/issues/25346).
