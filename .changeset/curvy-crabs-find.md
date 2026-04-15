---
'@mastra/core': patch
---

Fixed toolInvocations not being populated on messages retrieved from storage. When messages with tool calls were saved during streaming, the top-level toolInvocations array was missing because it was never built from the content parts. This caused downstream consumers that rely on toolInvocations (like provider compatibility layers) to see an empty field even though the tool data was present in content.parts.
