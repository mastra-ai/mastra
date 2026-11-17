---
'@mastra/factory': patch
---

Fixed Vanta sync closing every filed vulnerability card when Vanta is not connected. Without an active connection the sync now does nothing and reads no projects, and a vulnerability list cut off by the page limit fails the sync instead of closing the cards past the limit.
