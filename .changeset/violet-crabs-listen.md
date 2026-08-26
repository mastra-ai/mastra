---
'@mastra/core': patch
---

Fixed resumed sub-agent delegations failing thread-ownership validation. The resume path backfilled the thread from the suspended run's snapshot but still passed a freshly generated resource ID, so resuming a delegated run threw "A thread can only be used by the resource that owns it". Both the thread and resource are now restored from the snapshot on resume. Also fixed model stream transport handles (e.g. WebSocket routing) being dropped when `modelSettings.timeout` wraps the model stream.
