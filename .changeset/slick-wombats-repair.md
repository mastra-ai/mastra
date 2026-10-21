---
'@mastra/playground-ui': patch
---

Agent runs started by a signal now show what started them in the trace span details, instead of a raw JSON dump of the signal. Skills show as a skill row with their name, arguments and instructions, user signals as a user message, and other signals (such as system reminders) labelled by their tag, followed by the signal's type, tag, attributes and id. Skill signals in the trace Messages tab and in chat now also render as a skill row.
