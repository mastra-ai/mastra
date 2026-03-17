---
'@mastra/playground-ui': patch
---

Add a feature-gated theme toggle to Studio Settings with persisted preference in local storage. Run `MASTRA_THEME_TOGGLE=true mastra studio` to enable it. The Studio Settings theme selector supports `dark`, `light`, and `system` (follow OS); when `MASTRA_THEME_TOGGLE` is false, Studio remains dark-only and the selector is hidden.
