---
'@mastra/client-js': patch
---

Fixed `ResponsesStream` dropping or merging events when a Responses API stream frames its server-sent events with CRLF (`\r\n\r\n`) line endings. The stream iterator only recognized `\n\n` as an event boundary, so CRLF-framed frames stayed buffered until the connection closed and were then parsed together, which raised a `SyntaxError` from `JSON.parse` and yielded no events. `ResponsesStream` now treats any two adjacent line endings (`\r\n`, `\n` or `\r`) as a blank-line boundary, so the `\r\n\r\n`, `\n\n`, `\r\r` and mixed `\n\r\n`, `\n\r` and `\r\n\r` forms all emit each event as it completes, including when the delimiter is split across chunks.
