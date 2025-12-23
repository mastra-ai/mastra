import { openai } from '@ai-sdk/openai';
import { openai as openaiV6 } from '@ai-sdk/openai-v6';
import { setupStreamingMemoryTest } from './shared/streaming-memory';
import { setupUseChatV4, setupUseChatV5Plus } from './shared/useChat';
import { useChat as useChatV5 } from '@ai-sdk/react-v5';
import { useChat as useChatV6 } from '@ai-sdk/react-v6';
import { memory } from './v4/mastra/agents/weather';
import { weatherTool as weatherToolV4 } from './v4/mastra/tools/weather';
import { weatherTool as weatherToolV5 } from './v5/mastra/tools/weather';
import { weatherTool as weatherToolV6 } from './v6/mastra/tools/weather';

setupUseChatV4();

setupUseChatV5Plus({ useChatFunc: useChatV5, version: 'v5' });

setupUseChatV5Plus({ useChatFunc: useChatV6, version: 'v6' });

setupStreamingMemoryTest({
  model: openai('gpt-4o'),
  memory,
  tools: { get_weather: weatherToolV4 },
});

setupStreamingMemoryTest({
  model: 'openai/gpt-4o',
  memory,
  tools: { get_weather: weatherToolV5 },
});

setupStreamingMemoryTest({
  model: openaiV6('gpt-4o'),
  memory,
  tools: { get_weather: weatherToolV6 },
});
