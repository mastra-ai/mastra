---
'@mastra/server': patch
---

The memory save-messages route now removes the `mastra.modelOutputOrigin` marker from client-sent messages, so a client cannot mark a stored tool output as computed by the server. This works with any supported `@mastra/core` version; older versions never read the marker.
