---
'@mastra/playground-ui': patch
---

Raised the `react` and `react-dom` peer ranges to `>=19.2.0`. The package already uses `useEffectEvent`, which shipped in React 19.2, so apps on React 19.0 or 19.1 installed it without a warning, then hit a runtime error once one of those components rendered.

If your app is on React 19.0 or 19.1, upgrade `react` and `react-dom` to 19.2 or later.
