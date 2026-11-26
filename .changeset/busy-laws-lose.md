---
'@mastra/playground-ui': patch
---

Fixed the extra space under full-height tables. Pages whose last item fills the height and scrolls on its own, such as Traces and Logs, now end 16px from the bottom like their sides. Pages that scroll as a whole keep their end space.
