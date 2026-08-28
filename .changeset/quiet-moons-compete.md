---
'@mastra/core': patch
---

Automatic thread selection now skips threads locked by another live process and resumes the next unlocked one (or creates a fresh thread), instead of failing startup. Explicitly targeting a locked thread still throws. (#21243)
