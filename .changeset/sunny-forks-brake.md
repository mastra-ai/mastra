---
'mastracode': patch
---

Web UI overhaul: internal refactor plus skeleton loading states.

- Loading states now render skeleton placeholders instead of loading text or blank screens (settings sections, directory picker, GitHub repo list, sidebar sign-in check, and route auth guards).
- Internal refactor with no user-facing behavior changes: prop drilling replaced with dedicated React contexts (project selection, chat session, overlays), the AppLayout/AppContent indirection dissolved into a slotted ChatLayout with chat-domain components (ChatHeader, ChatMessageList, ComposerPanel, ChatOverlays), sidebar sections consume contexts directly, and the relativeTime helper moved to a shared date module backed by date-fns.
