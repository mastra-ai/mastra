---
'@mastra/playground-ui': patch
---

Scrolling a long `MessageScroller` stays smooth with thousands of messages. Which messages are on screen no longer travels through React context, so a scroll only re-renders the components that read it, such as `ThreadRail`, instead of making React walk every message below the scroller. Finding the current turn also measures a handful of turns per scroll instead of all of them.
