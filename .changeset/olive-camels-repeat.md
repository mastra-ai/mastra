---
'@mastra/server': patch
---

Documented the optional `requestContext` body field on agent controller run routes (send message, steer, follow-up, tool approval, tool suspension) so it appears in the generated OpenAPI spec. The server already merged this field into the request context; only the route schemas were missing it.
