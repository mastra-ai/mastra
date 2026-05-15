---
'@mastra/nestjs': patch
---

Fixed NestJS route matching so configured prefixes are enforced and partial prefix matches are ignored. For example, a prefix of `/api` no longer matches `/apiish/agents`; only `/api` and `/api/*` are treated as Mastra routes.
