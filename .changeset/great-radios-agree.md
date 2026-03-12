---
'@internal/playground': patch
---

Improved studio initial load performance with route-level code splitting. Pages are now lazy-loaded when navigated to, reducing the initial bundle size by ~712KB. The studio shell (sidebar, navigation) loads immediately while page content loads with a spinner fallback.
