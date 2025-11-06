// @ts-nocheck

import { Agent } from '@mastra/core/agent';

const agent = new Agent({
  voice: {
    speakProvider: murfVoice,
    listenProvider: deepgramVoice,
    realtimeProvider: openaiRealtime,
  },
});
