---
'@mastra/core': patch
---

Fixed durable agents rebuilding a run on another worker, or after a restart, with the wrong request processors. The rebuilt run now uses the processors configured on the wrapped agent, so processors that rewrite the outbound model request keep running, and a per-call `errorProcessors: []` still turns error processors off.
