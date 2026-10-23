import { defineLibConfig } from '@internal/types-builder/tsdown';

export default defineLibConfig({
  entry: ['src/index.ts'],
  dts: true,
  deps: {
    neverBundle: ['@mastra/agent-browser', '@mastra/core', '@mastra/core/browser', 'agent-browser', 'firecrawl'],
  },
});
