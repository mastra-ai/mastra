---
'@internal/playground': patch
---

Refined the Studio workspace page into a more polished, VS Code-style experience.

- **Skills are first-class.** Selecting a skill in the file tree opens a rich overview with its description, rendered SKILL.md (with a source toggle), references, and a copy-ready `npx skills add` command for skills installed from skills.sh.
- **Markdown files render formatted by default**, with a Rendered/Source toggle to inspect the raw markdown.
- **Search has its own view.** The left rail swaps between the file tree and backend-powered (BM25/Vector) search results; clicking a result opens that file in the editor, with matches highlighted.
- Polished the file tree (clear active selection) and the file viewer (design-system surfaces, path breadcrumb).
