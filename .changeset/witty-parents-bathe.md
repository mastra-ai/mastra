---
'@mastra/playground-ui': patch
'@mastra/factory': patch
---

Factory now starts skill runs with a typed `skill` signal (`type: 'reactive'`, `tagName: 'skill'`, `attributes: { name }`) instead of a user message holding a `<skill name="…">` envelope. Traces and memory now show the kickoff as the skill it is, not as something a person typed.
