---
'@mastra/agent-builder': patch
'@mastra/editor': patch
'@mastra/code-sdk': patch
---

Raised the `@mastra/core` peer dependency floor to 1.84.0. These packages depend on `@mastra/memory` at runtime, which now requires `@mastra/core` 1.84.0 or later. Upgrade `@mastra/core` together with these packages.
