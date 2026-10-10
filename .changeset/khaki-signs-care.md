---
'@mastra/core': patch
---

Improved skill discovery through `skill_search`:

- **Name and description search:** `skill_search` now finds skills by name and description, not just by the text inside `SKILL.md` and reference files. With BM25 or vector search, each skill adds one small search document for its name and description (one extra embedding per skill with vector search). Searches without BM25 or vector search now rank skills by how many query words they contain, instead of returning nothing unless the whole query appears verbatim.
- **Reference file paths in results:** results from reference files now include the file path (for example `references/style-guide.md`), so the agent can open the match with `skill_read`.
- **Shorter not-found messages:** when the agent asks `skill` or `skill_read` for a skill that doesn't exist and more than 20 skills are available, the tool suggests up to five close matches and points to `skill_search` instead of listing every skill.
