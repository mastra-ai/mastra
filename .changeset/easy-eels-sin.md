---
'@mastra/core': patch
'@mastra/playground-ui': patch
---

**Skill tools now reliably stay available across conversation turns.**

Previously, skill tools could be lost between turns because they were tied to processor state that wasn't guaranteed to persist. They are now registered at the Agent level and always available.

- Renamed `skill-activate` → `skill` — returns full skill instructions directly in the tool result
- Consolidated `skill-read-reference`, `skill-read-script`, `skill-read-asset` → `skill_read`
- Renamed `skill-search` → `skill_search`
- `<available_skills>` in the system message is now sorted deterministically for prompt cache stability
