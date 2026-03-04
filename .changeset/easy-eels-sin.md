---
'@mastra/core': patch
'@mastra/playground-ui': patch
---

**Skill tools now stay available across conversation turns.**

Previously, skill tools were lost between turns because they were re-created on every `stream()`/`generate()` call. They are now registered at the Agent level and persist across turns.

- Renamed `skill-activate` → `skill` — returns full skill instructions directly in the tool result
- Consolidated `skill-read-reference`, `skill-read-script`, `skill-read-asset` → `skill_read`
- Renamed `skill-search` → `skill_search`
- `<available_skills>` in the system message is now sorted deterministically for prompt cache stability
- Fixed `needsApprovalFn` not being carried through for non-Vercel tools
