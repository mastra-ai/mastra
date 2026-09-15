---
'@mastra/code-sdk': patch
---

Improved cross-agent discovery with live thread titles and passive sender attribution for every signal.

Inbound peer signals now expose the stable sender id as `sourcePeerId`, including fire-and-forget messages:

```xml
<notification sourcePeerId="code-agent:resource-1:thread-1" expectsReply="false">
  Peer work completed.
</notification>
```
