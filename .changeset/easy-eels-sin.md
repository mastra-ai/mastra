---
'@mastra/core': patch
'@mastra/playground-ui': patch
---

**Skill tools now stay available across turns and approval/resume flows.**

Previously, skill tools were created inside `SkillsProcessor` which was re-instantiated on every `stream()`/`generate()` call, causing activated skills and their tools to be lost between conversation turns.

- Renamed `skill-activate` → `skill` — returns full skill instructions directly in the tool result instead of mutating system messages
- Consolidated `skill-read-reference`, `skill-read-script`, `skill-read-asset` → `skill_read`
- Renamed `skill-search` → `skill_search`
- Moved skill tools to the Agent class (via `createSkillTools`), matching how workspace tools are managed
- `SkillsProcessor` now only injects `<available_skills>` into the system message (sorted deterministically for prompt cache stability)
- Fixed `CoreToolBuilder` to carry `needsApprovalFn` from non-Vercel tools, so skill tools correctly bypass approval
- Playground UI now derives skill activation status from `skill` tool completion and resets state on thread/agent navigation
