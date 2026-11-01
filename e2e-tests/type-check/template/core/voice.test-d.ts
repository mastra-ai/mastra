// Voice provider packages bundle their own copy of MastraVoice, so its #private
// brand never matches core's. Agent and CompositeVoice must accept them
// through IMastraVoice (#29016).
import { describe, it } from 'vitest';
import { Agent } from '@mastra/core/agent';
import { CompositeVoice } from '@mastra/core/voice';
import { OpenAIRealtimeVoice } from '@mastra/voice-openai-realtime';

declare const realtime: OpenAIRealtimeVoice;

const agentBase = {
  id: 'voice-agent',
  name: 'Voice Agent',
  instructions: 'You are a voice assistant.',
  model: 'openai/gpt-6.1-sol',
} as const;

describe('voice providers from other packages (#29016)', () => {
  it('accepts a provider as the agent voice', () => {
    new Agent({ ...agentBase, voice: realtime });
  });

  it('accepts a provider in CompositeVoice', () => {
    new CompositeVoice({ input: realtime, output: realtime, realtime });
  });
});
