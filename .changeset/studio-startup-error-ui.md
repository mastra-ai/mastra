---
'@internal/playground': patch
---

Improved how the Studio surfaces startup failures before React mounts. Import errors and direct boot failures now render a clear fallback in the page instead of leaving a blank screen, while normal runtime errors stay with React, route error states, and Vite's dev overlay.
