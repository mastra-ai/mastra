---
'@mastra/elysia': patch
---

Fixed two Elysia server problems on Node (`@elysiajs/node`) ([#29667](https://github.com/mastra-ai/mastra/issues/29667)):

- A `POST`, `PUT`, `PATCH` or `DELETE` request with `Content-Type: application/json` and an empty body no longer fails with 400 before the route runs. For example, aborting a run from a client that always sends the JSON header now works.
- A stream that fails partway, such as observing a run whose replay ends in an error, now delivers the frames sent before the error and ends the response. Before, the connection was dropped and the client got nothing or a cut-off body.

Malformed JSON still returns 400, now with the same body as the other adapters: `{ "error": "Invalid request body", "issues": [{ "field": "body", "message": "..." }] }`.
