import { mastra } from './index.ts';

// Agent
(async () => {
  const durableAgent = mastra.getAgent('durableResearchAgent');
  const { output, cleanup } = await durableAgent.stream('Hello, what can you tell me about the fifa world cup?');
  let text = '';
  for await (const chunk of output.fullStream) {
    if (chunk.type === 'text-delta') {
      text += chunk.payload.text;
    }
  }
  console.log(text);
  cleanup();
})();
