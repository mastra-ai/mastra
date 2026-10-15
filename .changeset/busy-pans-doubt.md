---
'@mastra/playground-ui': patch
'@mastra/factory': patch
---

Added `parseSkillBody(name, text)` to parse skill signal contents (instructions, `ARGUMENTS:` and a trailing work-item feed) when the skill name comes from signal attributes rather than a `<skill>` envelope.
