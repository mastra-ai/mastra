---
'@mastra/playground-ui': patch
'@internal/playground': patch
---

Add a feature-gated light mode toggle to Studio Settings with persisted theme preference in local storage. When `MASTRA_THEME_TOGGLE=true`, users can switch between dark and light themes and the preference is restored after reload; when disabled, Studio remains dark-only with no theme toggle shown.
