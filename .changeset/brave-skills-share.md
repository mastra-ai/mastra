---
'@mastra/core': patch
---

Fixed skill search failing when two skills share a name. Searching no longer throws "multiple local skills found"; each matching skill is returned with its own path, and `skill_search` results now show that path next to the skill name so agents can load the right copy. Getting a skill by an ambiguous name still errors.
