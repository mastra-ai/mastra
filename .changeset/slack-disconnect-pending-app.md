---
'@mastra/slack': patch
---

Fixed `disconnect()` orphaning Slack apps for pending installations. Connecting an agent mints a real Slack app via the manifest API before the OAuth install completes; disconnecting during that pending window previously removed only the local record and left the app behind in the Slack workspace. `disconnect()` now deletes the minted app for pending installations too.
