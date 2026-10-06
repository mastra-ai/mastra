---
'@mastra/code-sdk': patch
---

The Knowledge inspector now creates project and thread scopes that own themselves, matching every other Knowledge consumer. Previously the first inspector visit made a project scope owned by its organization, which hid that project's knowledge from Subconscious curation in the same project.
