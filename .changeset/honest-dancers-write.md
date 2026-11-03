---
'@mastra/code-sdk': patch
---

Fixed loading sparse settings files rewriting them with every default. When `preferences.previewLines` is missing, loading now adds only the resolved preview limit and leaves the rest of the file as written. Explicit saves and legacy migrations still persist the full settings.
