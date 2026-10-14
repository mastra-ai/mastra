---
'@mastra/core': patch
---

Fixed the goal judge treating the "Continue." message that Mastra adds for Gemini 3+ (and for Claude with structured output) as something the user said. The judge now sees the user's real latest message, so a goal waiting at an approval checkpoint is no longer moved along by a message nobody sent. Fixes #25541.
