# @mastra/perplexity

## 0.1.0-alpha.1

### Minor Changes

- Added new `@mastra/perplexity` integration with the Perplexity Search tool for agents. ([#15939](https://github.com/mastra-ai/mastra/pull/15939))

  ```ts
  import { createPerplexityTools } from '@mastra/perplexity';

  const { perplexitySearch } = createPerplexityTools({ apiKey: process.env.PERPLEXITY_API_KEY });
  ```

### Patch Changes

- Updated dependencies [[`2b0f355`](https://github.com/mastra-ai/mastra/commit/2b0f3553be3e9e5524da539a66e5cf82668440a4)]:
  - @mastra/core@1.31.0-alpha.2

## 0.1.0-alpha.0

### Minor Changes

- Initial release. Adds `createPerplexitySearchTool` and `createPerplexityTools` for the [Perplexity Search API](https://docs.perplexity.ai/docs/search/quickstart).
