---
'@mastra/client-js': patch
---

Deserialize workflow errors on the client side

When workflows fail, the server sends `SerializedError` (plain JSON object) over HTTP. This change deserializes those errors back to proper `Error` instances on the client, enabling:
- `instanceof Error` checks
- Access to `error.message`, `error.name`, `error.stack`
- Preservation of custom error properties (e.g., `statusCode`, `responseHeaders`)
- Proper cause chain reconstruction

Affected methods:
- `startAsync()`
- `resumeAsync()`
- `restartAsync()`
- `timeTravelAsync()`
