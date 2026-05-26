---
'@mastra/playground': patch
---

Internal: scaffold the Agent Builder left-sidebar pages (My agents, Skills, Favorites, Library, Infrastructure) along with the root redirect, root layout, and their direct dependencies. The pages and supporting hooks/components are added to the codebase but are not yet wired into `App.tsx`, so they are unreachable at runtime in this change. Wiring and the create/edit/view flows ship in follow-up PRs.
