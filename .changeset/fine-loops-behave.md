---
'@mastra/playground-ui': patch
---

The shimmer used by streaming text now ships its own stylesheet with the `Shimmer` component instead of relying on a keyframe declared in the global theme, so it animates in any app that imports the component. The sweep travels a fixed distance rather than a multiple of the text width, so a short label no longer sweeps faster than a long one and two labels side by side stay in step. It also stops under `prefers-reduced-motion`.
