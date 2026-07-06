---
'mastracode': patch
---

Restructure the web chat UI around chat-domain components: the AppLayout/AppContent indirection is dissolved into a slotted ChatLayout (sidebar/header/content/footer + mobile backdrop) composed by Chat.tsx, with new ChatHeader, ChatMessageList, ComposerPanel, and ChatOverlays components. Internal refactor, no user-facing behavior changes.
