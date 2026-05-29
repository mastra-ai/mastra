---
'@mastra/core': patch
---

Fixed UnixSocketPubSub streaming so a slow or stuck subscriber no longer blocks active local streams or other subscribers.
