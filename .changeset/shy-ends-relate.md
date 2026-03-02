---
'@mastra/playground-ui': patch
---

Fixed sub-agent collapsible sections in Studio UI to automatically collapse after the sub-agent finishes processing. Previously the section would stay expanded for the entire agent lifecycle, creating visual noise. Now the sub-agent section expands while active and collapses when done. Users can still manually re-open it by clicking.
