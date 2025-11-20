// @ts-nocheck

import { Agent } from '@mastra/core/agent';

const agent = new Agent({});
const abortController = new AbortController();

const result = await agent.stream('Hello World', {
  modelSettings: {
    setting: 'value1',
    otherSetting: 'value2'
  },

  abortSignal: abortController.signal,
  otherKey: 'otherValue'
});
