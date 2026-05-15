---
'@mastra/playground-ui': patch
---

Fixed the Observability traces page on storage providers that don't support the Branches list mode. The page now falls back to Traces mode, hides the Branches option in the filter, and shows a dismissible notice instead of a full-screen error.
