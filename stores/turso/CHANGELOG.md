# @mastra/turso

## 0.1.0-alpha.1

### Minor Changes

- Added native Turso Database file storage for Mastra agents, workflows, memory, and other storage domains. ([#22181](https://github.com/mastra-ai/mastra/pull/22181))

  ```typescript
  import { TursoStore } from '@mastra/turso';

  const storage = new TursoStore({
    id: 'local-storage',
    path: './mastra.db',
  });
  ```

### Patch Changes

- Updated dependencies [[`db6940e`](https://github.com/mastra-ai/mastra/commit/db6940ea63b76df2bc0a7c105a493342b9eaf0ec), [`ae8790c`](https://github.com/mastra-ai/mastra/commit/ae8790c4bfaa088d2ab279d1dcc06f326b9fd109), [`04a815f`](https://github.com/mastra-ai/mastra/commit/04a815fc8971d29e97fcdcc5008a1eb472fc00ff), [`db6940e`](https://github.com/mastra-ai/mastra/commit/db6940ea63b76df2bc0a7c105a493342b9eaf0ec), [`cced745`](https://github.com/mastra-ai/mastra/commit/cced745a056ec2225c5bc702e32d848847aa8b65)]:
  - @mastra/libsql@1.22.0-alpha.1
  - @mastra/core@1.62.0-alpha.7
