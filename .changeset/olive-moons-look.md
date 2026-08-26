---
'@mastra/playground-ui': patch
---

**Composer** — the ring keeps its geometry on the element, so a consumer can restyle its radius and width through `className` like any other component. Its idle edge colour now reads `--composer-ring-edge`, for apps whose chat surface needs a different one; unset, it keeps the current blend.

**Tool call** — output blocks sit one step above the surface behind them instead of painting a fixed dark grey, so they stay visible on any chat background and in both themes.
