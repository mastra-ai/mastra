---
'mastra': patch
---

Fixed Studio scorers page crash when navigating directly to a scorer URL or reloading the page. The page would crash with 'Cannot read properties of undefined' due to a race condition between scorer and agents data loading.
