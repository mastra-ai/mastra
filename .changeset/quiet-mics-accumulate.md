---
'@mastra/react': patch
---

Fix `useSpeechRecognition` (browser path) dropping earlier finalized phrases during continuous dictation. Each `onresult` event now appends its finalized results to the session transcript instead of replacing it, and the transcript resets when a new dictation session starts. Fixes #24330.
