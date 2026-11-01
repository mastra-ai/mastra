import { MessageList } from '@mastra/core/agent/message-list';
import { MastraModelOutput } from '@mastra/core/stream';
import type { ChunkType } from '@mastra/core/stream';
import { createClient } from 'redis';

const [url, key, firstStepIndex] = process.argv.slice(2);
const redis = createClient({ url });
await redis.connect();
try {
  const entries = await redis.xRange(key!, '-', '+');
  const chunks = entries
    .map(entry => JSON.parse(entry.message.event!) as { type: string; data?: ChunkType })
    .filter(event => event.type === 'chunk' && event.data)
    .map(event => event.data!);
  const firstStep = Number(firstStepIndex);
  let stepCount = 0;
  const firstChunk =
    firstStep === 0 ? 0 : chunks.findIndex(chunk => chunk.type === 'step-finish' && stepCount++ === firstStep);
  const observed: string[][] = [];
  const output = new MastraModelOutput({
    model: { modelId: undefined, provider: undefined, version: 'v3' },
    stream: new ReadableStream<ChunkType>({
      start(controller) {
        for (const chunk of chunks.slice(firstChunk)) controller.enqueue(chunk);
        controller.close();
      },
    }),
    messageList: new MessageList(),
    messageId: 'remote-observer',
    options: {
      runId: 'remote-observer',
      isLLMExecutionStep: true,
      resolveFinalPromises: true,
      onStepFinish: result => {
        observed.push(
          (result.response.messages ?? []).flatMap(message =>
            message.role === 'tool' && Array.isArray(message.content)
              ? message.content.filter(part => part.type === 'tool-result').map(part => part.toolCallId)
              : [],
          ),
        );
      },
    },
  });
  for await (const _chunk of output.fullStream) {
    /* consume real model output */
  }
  process.stdout.write(`${JSON.stringify({ observed })}\n`);
} finally {
  await redis.quit();
}
