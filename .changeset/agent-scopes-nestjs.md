---
'@mastra/nestjs': patch
---

The NestJS server marks itself as reserving agent scopes, like the other server adapters. Its routes already ignore `scopes` in request bodies and treat `mastra__scopes` as reserved, so agents accept scopes from your code and middleware when served through NestJS.
