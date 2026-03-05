---
'@mastra/core': patch
---

**Skill tools are now stable across conversation turns and prompt-cache friendly.**

- Renamed `skill-activate` → `skill` — returns full skill instructions directly in the tool result
- Consolidated `skill-read-reference`, `skill-read-script`, `skill-read-asset` → `skill_read`
- Renamed `skill-search` → `skill_search`
- `<available_skills>` in the system message is now sorted deterministically
