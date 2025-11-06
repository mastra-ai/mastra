// @ts-nocheck

import { Agent } from '@mastra/core/agent';

const agent = new Agent({
  voice: {
    output: murfVoice,
    input: deepgramVoice,
    realtime: openaiRealtime,
  },
});
