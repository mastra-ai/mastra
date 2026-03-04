---
'@mastra/core': patch
---

**Fixed skill tools losing state across turns**

Skill tools (`skill-activate`, `skill-search`, `skill-read-*`) were previously created inside `SkillsProcessor` which was re-instantiated on every `stream()`/`generate()` call. This caused activated skills and their read tools to be lost between conversation turns.

**Changes:**

- Renamed `skill-activate` to `skill` — now returns the full skill instructions directly in the tool result instead of injecting them into system messages
- Consolidated `skill-read-reference`, `skill-read-script`, and `skill-read-asset` into a single `skill_read` tool
- Renamed `skill-search` to `skill_search`
- Moved all skill tools from `SkillsProcessor` to the Agent class via `createSkillTools()` and `listSkillTools()`, matching how workspace tools are managed
- `SkillsProcessor` now only handles injecting `<available_skills>` into the system message (sorted deterministically for prompt cache stability)
- Fixed `CoreToolBuilder` to carry `needsApprovalFn` from non-Vercel tools, so skill tools correctly bypass approval

**Migration:** If you were using the `skill-activate` tool name, update to `skill`. If using `skill-read-reference`/`skill-read-script`/`skill-read-asset`, update to `skill_read`. If using `skill-search`, update to `skill_search`.
