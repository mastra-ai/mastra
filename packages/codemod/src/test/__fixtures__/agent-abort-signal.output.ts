// @ts-nocheck

import { Agent } from '@mastra/core/agent';

const agent = new Agent({});
const abortController = new AbortController();
const otherSignal = new AbortController().signal;

const result = await agent.stream('Hello World', {
  modelSettings: {
    setting: 'value1',
    otherSetting: 'value2'
  },

  abortSignal: abortController.signal,
  otherKey: 'otherValue'
});

const conflicting = await agent.generate('Hello World', {
  abortSignal: abortController.signal,
  modelSettings: {
    abortSignal: otherSignal,
  },
});

const quoted = await agent.generate('Hello World', {
  "abortSignal": abortController.signal,
  modelSettings: {
    abortSignal: otherSignal,
  },
});

const alreadyMigrated = await agent.generate('Hello World', {
  abortSignal: abortController.signal,
  modelSettings: {
    setting: 'value1',
  },
});
