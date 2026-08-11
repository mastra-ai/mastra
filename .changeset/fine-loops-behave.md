---
'@mastra/playground-ui': patch
---

Fixed the shimmer that runs under streaming text. It now animates in every app that renders the `Shimmer` component, a short label sweeps at the same speed as a long one so labels side by side stay in step, and the sweep stops under `prefers-reduced-motion`.
