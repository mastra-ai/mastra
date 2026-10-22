---
'@mastra/inngest': patch
---

Preserve tool calls made before suspension in the completed output of a resumed Inngest agent. The resumed stream seeds its tool-call history from the persisted execution snapshot without replaying earlier stream chunks or re-running tools.
