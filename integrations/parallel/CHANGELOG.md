# @mastra/parallel

## 0.1.0-alpha.0

### Minor Changes

- Added Parallel Search and Extract tools for Mastra agents through the new `@mastra/parallel` package. ([#22070](https://github.com/mastra-ai/mastra/pull/22070))

  ```typescript
  import { createParallelTools } from '@mastra/parallel';

  const tools = createParallelTools();
  ```

### Patch Changes

- Updated dependencies [[`8661d7d`](https://github.com/mastra-ai/mastra/commit/8661d7d7179f0a024456aabdd8679bcecd09ac28), [`cacb839`](https://github.com/mastra-ai/mastra/commit/cacb8392d9e74189b56d857290b0615f98a2683d), [`91ad69d`](https://github.com/mastra-ai/mastra/commit/91ad69d64994c89199b0c55399e64ed91c61df2f), [`c5eaec5`](https://github.com/mastra-ai/mastra/commit/c5eaec5a860d80d0e3805e67db0414b87ac8cbed), [`e66b2ba`](https://github.com/mastra-ai/mastra/commit/e66b2ba100db63eaeab6e21e1ea34b113f2ec781)]:
  - @mastra/core@1.62.0-alpha.3
