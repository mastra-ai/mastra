---
'@mastra/playground-ui': patch
---

Tab bars that are too wide for their container now fade out at the clipped edge instead of cutting a tab off mid-word, so it reads as scrollable. The fade follows the scroll position and only appears when the tabs actually overflow — a tab bar that fits renders exactly as before.
