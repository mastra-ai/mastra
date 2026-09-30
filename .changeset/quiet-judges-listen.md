---
'@mastra/core': patch
---

Fixed the goal judge treating the "Continue." turn that Mastra adds for Claude 4.6+ and Gemini 3+ as a real user message. On those models the judge could be told the user said "Continue." when they had said nothing, which could move a goal past a checkpoint that was waiting for the user. The judge now sees the user's actual latest message.
