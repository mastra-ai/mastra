import { Agent, MastraDBMessage, MessageList } from '@mastra/core/agent';
import { Processor, ProcessorMessageResult, ProcessOutputStepArgs } from '@mastra/core/processors';
import { createTool } from '@mastra/core/tools';
import z from 'zod';

class OutputStepUsageLogger implements Processor {
  readonly id = 'OutputStepUsageLogger';
  readonly name = 'OutputStepUsageLogger';

  async processOutputStep({
    messageList,
    usage,
    stepNumber,
  }: ProcessOutputStepArgs<unknown>): Promise<MessageList | MastraDBMessage[]> {
    console.log('step ', stepNumber, 'usage', usage);
    return messageList;
  }
}

async function main() {
  console.log('running main');

  const weatherTool = createTool({
    id: 'weather',
    description: 'Get the weather for a city',
    inputSchema: z.object({
      city: z.string(),
    }),
    execute: async () => {
      const randomm = Math.floor(Math.random() * 100);
      return 'The weather is ' + randomm;
    },
  });

  const simpleAgent = new Agent({
    id: 'simple-agent',
    name: 'Simple Agent',
    instructions: `You are a coding assistant.`,
    model: 'vercel/google/gemini-3-flash-preview',
    outputProcessors: [new OutputStepUsageLogger()],
    tools: { weather: weatherTool },
  });

  const stream = await simpleAgent.stream({
    id: 'msg-123',
    role: 'user',
    parts: [{ type: 'text', text: 'whats the weather in nyc and washington?' }],
  });

  for await (const chunk of stream.fullStream) {
    if (chunk.type === 'tripwire') {
      console.log('🚫 Tripwire detected during streaming!');
      console.log('  Reason:', chunk.payload?.reason);
      console.log('  Retry allowed:', chunk.payload?.retry);
      console.log('  Metadata:', JSON.stringify(chunk.payload?.metadata, null, 2));
      console.log('  Processor ID:', chunk.payload?.processorId);
      break;
    } else if (chunk.type === 'text-delta') {
      // Normal text streaming
      process.stdout.write(chunk.payload?.text || '');
    } else {
      console.log(JSON.stringify(chunk));
    }
  }
}

main();
