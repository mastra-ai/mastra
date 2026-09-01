---
'@mastra/server': patch
---

Serialized agents now report a `hasBrowser` capability flag that is true for agent-level SDK browsers and workspace-level CLI browsers (which expose no SDK tools). Fixes https://github.com/mastra-ai/mastra/issues/22535
