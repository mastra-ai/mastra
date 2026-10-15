---
'@mastra/factory': patch
---

Factory now starts skill runs with a typed skill signal instead of a user message. Traces and memory show the kickoff as the skill that started the run, not as something a person typed. The signal is `{ type: 'reactive', tagName: 'skill', attributes: { name } }`, and the model still sees `<skill name="…">…</skill>`.

Skills you start from the chat are unchanged and still send a user message.
