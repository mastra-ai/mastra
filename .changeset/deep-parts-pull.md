---
'@mastra/client-js': patch
---

Fixed `@mastra/client-js` requests that fail to parse a successful response with an empty body (for example a `200`, `204` or `205` with no content). These responses now resolve to `undefined` instead of throwing a JSON parse error, while other success, error and streaming behavior is unchanged.
