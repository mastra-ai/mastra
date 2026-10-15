---
'@mastra/playground-ui': patch
---

Added `parseSkillBody(name, text)` for skill signals that carry the skill name as an attribute. It splits the text into instructions, `ARGUMENTS:` and a trailing work-item feed, like `parseSkillActivation` does for `<skill name="…">` messages.
