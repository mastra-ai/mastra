# @mastra/dsql

## 1.0.0-alpha.3

### Minor Changes

- Added Amazon Aurora DSQL storage provider with IAM authentication support. ([#10930](https://github.com/mastra-ai/mastra/pull/10930))

  Enables storing threads, messages, workflows, traces, and agent data in Amazon Aurora DSQL clusters.

  ```typescript
  import { DSQLStore } from '@mastra/dsql';

  const storage = new DSQLStore({
    id: 'my-dsql-store',
    host: 'abc123.dsql.us-east-1.on.aws',
  });

  await storage.init();
  ```

  Related: #10929

### Patch Changes

- Updated dependencies [[`f984b4d`](https://github.com/mastra-ai/mastra/commit/f984b4d6c60bf2ae2a9b156f0e8c35a66fe96c91), [`ce01024`](https://github.com/mastra-ai/mastra/commit/ce010242eee9bdfc09e4c26725b9d37998679a8d), [`f984b4d`](https://github.com/mastra-ai/mastra/commit/f984b4d6c60bf2ae2a9b156f0e8c35a66fe96c91), [`8373ff4`](https://github.com/mastra-ai/mastra/commit/8373ff46745d77af79f183c4470f80fa2727a6b2), [`11c1528`](https://github.com/mastra-ai/mastra/commit/11c152848c5d0ef227184853b5040f5b41ee7b1e)]:
  - @mastra/core@1.33.0-alpha.13
