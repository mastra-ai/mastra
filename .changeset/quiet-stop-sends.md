---
'@mastra/react': patch
---

Fixed `useChat` so pressing Stop no longer makes `sendMessage` reject with an `AbortError`. Callers that fired `void chat.sendMessage(...)` used to get an unhandled rejection in the console every time the user stopped a reply. Now `sendMessage` resolves when Stop (or a newer send) ends the reply.

Sending a new message while a reply is still streaming also no longer marks the chat as idle while the new reply is running. Aborting your own `signal` still rejects the send, as before.
