---
'@mastra/playground-ui': patch
---

Agent runs started by a signal now show what started them in traces, instead of a raw JSON dump of the signal.

- **Span details:** skills show as a skill row with their name, arguments and instructions; user signals as a user message; other signals (such as system reminders) labelled by their tag, followed by the signal's type, tag, attributes and id.
- **Span tree:** the agent run row carries a badge naming the signal that started it, such as `Skill factory-triage`.
- **Model calls:** a skill in a model call's input shows as a skill row instead of `<skill name="…">` markup.
- **Messages tab and chat:** skill signals render as a skill row.
