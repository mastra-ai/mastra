---
'@mastra/playground-ui': patch
---

The shimmer used by streaming text now ships its own stylesheet with the `Shimmer` component instead of relying on a keyframe declared in the global theme, so it works in any app that imports the component. The sweep also runs at a constant speed whatever the text length, loops without the jump it had at the end of each cycle, and stops under `prefers-reduced-motion`.
