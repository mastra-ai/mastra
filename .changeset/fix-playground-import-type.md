---
'@internal/playground': patch
---

Fixed studio crash caused by runtime components being erased from the sidebar import. Icons, layout components, and hooks were incorrectly imported as type-only, which TypeScript strips at compile time.
