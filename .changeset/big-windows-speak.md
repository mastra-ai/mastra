---
'@mastra/nestjs': patch
---

Fixed NestJS auth passing a Web Request to authenticateToken and authorize hooks so cookie-based providers (such as Better Auth) no longer fail with 401 on valid credentials.

Resolves https://github.com/mastra-ai/mastra/issues/21253
