---
'@mastra/client-js': patch
---

Fixed `ResponsesStream` dropping or merging events when a Responses API stream frames its server-sent events with CRLF (`\r\n\r\n`) line endings. The stream iterator only recognized `\n\n` as an event boundary, so CRLF-framed frames stayed buffered until the connection closed and were then parsed together, which raised a `SyntaxError` from `JSON.parse` and yielded no events. `ResponsesStream` now detects the first blank-line boundary in any of the `\r\n\r\n`, `\n\n` or `\r\r` forms and emits each event as it completes, including when the delimiter is split across chunks.
