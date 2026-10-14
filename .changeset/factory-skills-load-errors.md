---
'@mastra/factory': patch
---

Factory skills settings now flag a skill the agent cannot load. Skills are checked with the same frontmatter parser the agent uses, so a `SKILL.md` with invalid YAML (for example an unquoted `: ` in the `description`) shows "Failed to load" with the parse error, instead of looking healthy and then failing at kickoff with "skill not found".
