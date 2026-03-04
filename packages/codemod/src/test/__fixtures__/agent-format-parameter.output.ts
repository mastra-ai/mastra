// @ts-nocheck

import { Agent } from '@mastra/core/agent';

const agent = new Agent({});

const result = await agent.generate('Hello', {
  /* FIXME(mastra): The format parameter has been removed. See: https://mastra.ai/guides/migrations/upgrade-to-v1/agent#format-parameter-from-stream-and-generate */
  format: 'aisdk',
});
const stream = await agent.stream('Hello', {
  /* FIXME(mastra): The format parameter has been removed. See: https://mastra.ai/guides/migrations/upgrade-to-v1/agent#format-parameter-from-stream-and-generate */
  format: 'aisdk',
});
