# @mastra/brightdata

## 0.2.0-alpha.0

### Minor Changes

- Added `@mastra/brightdata` integration with `brightdata-search` and `brightdata-fetch` tools backed by Bright Data's SERP API and Web Unlocker. The tools bypass bot detection and CAPTCHAs out of the box. ([#16392](https://github.com/mastra-ai/mastra/pull/16392))

  ```typescript
  import { Agent } from '@mastra/core/agent';
  import { createBrightDataTools } from '@mastra/brightdata';

  const agent = new Agent({
    id: 'research-agent',
    name: 'Research Agent',
    model: 'anthropic/claude-sonnet-4-6',
    instructions: 'Use brightdata-search to find pages and brightdata-fetch to read them.',
    tools: createBrightDataTools(),
  });
  ```

  Set `BRIGHTDATA_API_TOKEN` in your environment, or pass `{ apiKey }` explicitly.

### Patch Changes

- Updated dependencies [[`b59316f`](https://github.com/mastra-ai/mastra/commit/b59316ffa0f7688165b0f9c81ccdf85da461e5b2), [`55f1e2d`](https://github.com/mastra-ai/mastra/commit/55f1e2d65425b95a49ae788053b266f256e38c96), [`d48a705`](https://github.com/mastra-ai/mastra/commit/d48a705ff3dfbdc7a996e07ecd8293b5effd9a2a)]:
  - @mastra/core@1.33.0-alpha.12
