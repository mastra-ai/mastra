---
'@mastra/core': patch
---

When no voice is set on agent don't throw error, by default set voice to undefined rather than DefaultVoice which throws errors when it is accessed.
