import { Agent } from '@mastra/core/agent';
import { OpenAIRealtimeVoice } from '/Users/yujohnnattrass/Mastra/mastra/voice/openai-realtime-api/src/';
import { openai } from '@ai-sdk/openai';

export const CafeAgent = new Agent({
  name: 'CafeAgent',
  instructions: `You are a helpful assistant that can help customers place orders at All Star Cafe. You can answer questions about the menu, take orders, and provide recommendations. You can also handle common tasks like payment and delivery.`,
  model: openai('gpt-4o'),
  voice: new OpenAIRealtimeVoice(),
});
