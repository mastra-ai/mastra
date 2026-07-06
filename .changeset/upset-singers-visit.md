---
'mastracode': patch
---

Internal refactor of the web UI sidebar: ProjectSwitcher, WorkspacesSection, ThreadList, and SidebarFooter now consume the active-project, chat-session, overlay, and toast contexts directly instead of receiving drilled props, and the redundant activeProjectId field was removed from the active-project API. No user-facing changes.
