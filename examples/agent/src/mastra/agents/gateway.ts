import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const helloWorldTool = createTool({
  id: 'hello-world',
  description: 'Returns a hello world greeting',
  inputSchema: z.object({}),
  outputSchema: z.object({ message: z.string() }),
  execute: async () => ({ message: 'Hello, World!' }),
});

export const gatewayAgent = new Agent({
  id: 'gateway-agent',
  name: 'Gateway Agent',
  description: 'A gateway agent that can route requests to the appropriate agent',
  instructions: 'You are a gateway agent that can route requests to the appropriate agent',
  model: 'mastra/openai/gpt-5-mini',
  tools: { helloWorldTool },
});
