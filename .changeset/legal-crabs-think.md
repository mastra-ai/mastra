---
'@mastra/client-js': patch
---

Fixed client-side tools getting stuck in `input-available` state in React's `useChat` messages. After a client tool finished executing, the React UI never observed a terminal `tool-result` (or `tool-error`) chunk for it, so the matching `dynamic-tool` part stayed at `state: 'input-available'` indefinitely. The client now emits a synthetic Mastra-shaped terminal chunk into the streamed response right after the client tool resolves or rejects, so the React reducer correctly flips the part to `output-available` (or `output-error`) and renders the tool result.
