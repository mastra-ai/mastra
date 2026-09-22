---
'@mastra/playground-ui': patch
---

Fixed the message scroller never asking for older history when a conversation opens on a turn taller than the viewport. `onReachStart` now arms as soon as the reader scrolls backwards, instead of waiting for a scroll event that lands at the very bottom.
