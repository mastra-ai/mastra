---
'@internal/playground': patch
---

Fixed sidebar and route header jumping in during cold page load. The Studio Layout was gating both pieces of chrome on `useAuthCapabilities()` having resolved, which left the main content stretched full-width until the request returned. The layout now renders the sidebar and header optimistically (sidebar width is already hydrated synchronously from `localStorage` by `MainSidebarProvider`) and only hides them once auth resolves as enabled-but-unauthenticated, so the original UX of a chromeless inline login form is preserved.
