---
'@mastra/code-sdk': patch
---

Fixed schedule summaries breaking across lines when a schedule's prompt or extra prompt contains line breaks. The summary now stays on one line in `/schedules`, in the fired schedule's header in the transcript, and in the schedule tool results the agent sees.
