---
'@mastra/nestjs': patch
---

Fixed built-in Mastra routes being reachable without authentication when their path matched `server.auth.public`. Built-in routes that require auth now stay protected on NestJS, as they already were on the other server adapters. Routes that opt out of auth, such as the auth capabilities route, are unchanged.
