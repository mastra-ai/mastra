---
'@mastra/core': patch
---

Fixed the tool payload transform policy being dropped on non-durable agent streams. When an agent was configured with a `transform` policy, `loop()` rebuilt its internal state bag but did not carry the policy forward, so it never reached the run scope and silently no-opped for the whole run. The policy is now forwarded, so tool call, tool result, and tool input delta payloads are transformed as configured. Closes #19102.
