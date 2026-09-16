---
'@mastra/code-sdk': patch
---

Improved cross-agent discovery with live thread titles and passive sender attribution for individually delivered peer signals.

Inbound peer signals now expose the stable sender id as `sourcePeerId`, including fire-and-forget messages, while `returnPeerId` is included only when a reply is required. Low-priority signals may first appear as a count-only notification summary and expose their full attribution when opened from the notification inbox:

```xml
<notification sourcePeerId="code-agent:resource-1:thread-1" expectsReply="false">
  Peer work completed.
</notification>
```
