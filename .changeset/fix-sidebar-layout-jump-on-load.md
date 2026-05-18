---
'@internal/playground': patch
---

Fixed a layout shift on cold page loads where the Studio sidebar and route header would pop in after the page rendered, briefly stretching the main content to full width. The chromeless inline login screen for unauthenticated users still appears as before.

Replaced the blank dark screen shown before the JavaScript bundle finishes loading with a centered, animated Mastra logo so opening Studio has visible feedback from the first paint.
