---
'mastra': patch
---

Fixed a crash in the Agent Editor when opening a code-defined agent whose `Workspace` discovers skills.

Previously the editor threw `TypeError: Cannot convert undefined or null to object` because workspace-discovered skill metadata (`SkillMetadata[]`) was being fed into the stored-skill-config form mapper, which expects a `Record<string, StoredAgentSkillConfig>`. Code-defined agents don't carry stored skill overrides, so this field is now left unset when loading them into the edit form.
