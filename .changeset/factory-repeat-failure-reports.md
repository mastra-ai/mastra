---
'@mastra/factory': patch
---

Fixed a work session that keeps failing the same way from flooding the sessions following it. A repeated, identical failure is now reported once; the next different failure, or any other report from that session, is delivered as usual.
