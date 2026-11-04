/** Ported from validation harness case T73 (ui-last-message). */
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { createOpenAI } from '@ai-sdk/openai-v7';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { expect, it } from 'vitest';
import { toAISdkV5Stream } from '../convert-streams';

it('background consumption does not steal the second UI reply or erase the first (COR-1409)', async () => {
  const requests: string[] = [];
  const server = createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    requests.push(body);
    const text = body.includes('second turn') ? 'second answer' : 'first answer';
    response.writeHead(200, { 'Content-Type': 'text/event-stream' });
    for (const delta of [{ content: text }, {}]) {
      response.write(
        `data: ${JSON.stringify({
          id: 'chat-reply',
          object: 'chat.completion.chunk',
          created: 1,
          model: 'gpt-4o',
          choices: [{ index: 0, delta, finish_reason: 'content' in delta ? null : 'stop' }],
        })}\n\n`,
      );
    }
    response.end('data: [DONE]\n\n');
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing HTTP server address');
  const storage = new LibSQLStore({ id: randomUUID(), url: ':memory:' });
  const memory = new Memory({ storage, options: { lastMessages: 100, semanticRecall: false, generateTitle: false } });
  const agent = createDurableAgent({
    agent: new Agent({
      id: randomUUID(),
      name: 'UI',
      instructions: 'Answer the current turn.',
      memory,
      model: createOpenAI({ apiKey: 'test-key', baseURL: `http://127.0.0.1:${address.port}/v1` }).chat('gpt-4o'),
    }),
  });
  const mastra = new Mastra({ agents: { agent }, storage, logger: false });
  const thread = randomUUID();
  const resource = randomUUID();
  try {
    const first = await agent.stream('first turn', { memory: { thread, resource } });
    await first.output.consumeStream();
    expect(await first.output.text).toBe('first answer');
    first.cleanup?.();
    const second = await agent.stream('second turn', { memory: { thread, resource } });
    const consumption = second.output.consumeStream();
    const parts = [];
    for await (const part of toAISdkV5Stream(second.output, { from: 'agent' })) parts.push(part);
    await consumption;
    expect(
      parts
        .filter(part => part.type === 'text-delta')
        .map(part => part.delta)
        .join(''),
    ).toBe('second answer');
    expect(parts.at(-1)?.type).toBe('finish');
    expect(parts.some(part => part.type === 'error')).toBe(false);
    const { messages } = await memory.recall({ threadId: thread, resourceId: resource });
    expect(
      messages
        .filter(message => message.role === 'assistant')
        .map(message =>
          message.content.parts
            ?.filter(part => part.type === 'text')
            .map(part => part.text)
            .join(''),
        ),
    ).toEqual(['first answer', 'second answer']);
    expect(requests).toHaveLength(2);
    second.cleanup?.();
  } finally {
    await mastra.shutdown();
    await storage.close();
    await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
  }
});
