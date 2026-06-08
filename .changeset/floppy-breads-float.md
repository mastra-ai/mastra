---
'@mastra/react': patch
---

Resume a suspended Web Audio context before playing agent speech, so text-to-speech is no longer silently muted in browsers (notably Safari) that suspend the AudioContext when it is created outside a direct user gesture.
