---
'@mastra/core': patch
---

Fixed `SkillSearchProcessor` so agents use it as the on-demand skill discovery path without also adding eager skill context.

When `SkillSearchProcessor` is configured, agents no longer auto-add the eager `SkillsProcessor`, and they hide the overlapping `skill` and `skill_search` tools while keeping `skill_read` available for supporting skill files. Workspace file tools can still read `SKILL.md` files during explicit file inspection or editing workflows.
