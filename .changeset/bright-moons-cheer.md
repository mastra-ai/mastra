---
"@mastra/nestjs": minor
"@mastra/server": patch
---

Add NestJS server adapter (`@mastra/nestjs`) for running Mastra with NestJS Express applications. Provides native module registration, DI-based service injection, rate limiting, graceful shutdown, streaming, and MCP transport support.

```typescript
import { Module } from "@nestjs/common";
import { MastraModule } from "@mastra/nestjs";
import { mastra } from "./mastra";

@Module({
  imports: [MastraModule.register({ mastra })],
})
export class AppModule {}
```

`@mastra/server`: Export `MastraServerBase` from `@mastra/core/server` to support framework adapters that handle routing independently (e.g. NestJS).
