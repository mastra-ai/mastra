# @mastra/nestjs

## 0.1.0-alpha.0

### Minor Changes

- Add NestJS server adapter (`@mastra/nestjs`) for running Mastra with NestJS Express applications. Provides native module registration, DI-based service injection, rate limiting, graceful shutdown, streaming, and MCP transport support. ([#12751](https://github.com/mastra-ai/mastra/pull/12751))

  ```typescript
  import { Module } from '@nestjs/common';
  import { MastraModule } from '@mastra/nestjs';
  import { mastra } from './mastra';

  @Module({
    imports: [MastraModule.register({ mastra })],
  })
  export class AppModule {}
  ```

### Patch Changes

- Updated dependencies [[`c600d54`](https://github.com/mastra-ai/mastra/commit/c600d5427277f44bc246b4daf70f77605ff1265c), [`8091c7c`](https://github.com/mastra-ai/mastra/commit/8091c7c944d15e13fef6d61b6cfd903f158d4006), [`04151c7`](https://github.com/mastra-ai/mastra/commit/04151c7dcea934b4fe9076708a23fac161195414), [`8091c7c`](https://github.com/mastra-ai/mastra/commit/8091c7c944d15e13fef6d61b6cfd903f158d4006)]:
  - @mastra/server@1.31.0-alpha.4
  - @mastra/core@1.31.0-alpha.4
