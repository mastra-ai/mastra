---
'mastra': minor
---

Added an advanced thread view in Studio: open an agent thread with `?variant=advanced` to read the conversation side by side with each turn's trace, and click any span to inspect its details.

```text
http://localhost:4111/agents/<agentId>/threads/<threadId>?variant=advanced
```

The same view is reachable from the "Advanced view" switch in the thread header, and from the "Voir le thread complet" link in a trace's Messages panel.
