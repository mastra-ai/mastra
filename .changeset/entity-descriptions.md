---
'@mastra/memory': patch
---

Subconscious capture now preserves canonical identifiers and URLs verbatim when the conversation states them for an entity, and curation maintains concise entity node content (what the entity is, its current state, and links to its real-world object) for the significant nodes touched by each worklist record.

**What changes for graph consumers**

- Entity nodes for people, projects, pull requests, issues, repositories, documents, and organizations carry short descriptions plus a links line instead of bare names.
- Links come only from the entity's own records or observations that explicitly associate them; the curator never invents URLs, identifiers, file paths, or provenance.
- Descriptions are refined incrementally as new records arrive rather than rewritten wholesale, using `knowledge_write_node_content` with optimistic version checks.
