import { once } from 'node:events';
import { createServer } from 'node:http';
import { createOpenAI as openaiV5 } from '@ai-sdk/openai-v5';
import { createOpenAI as openaiV6 } from '@ai-sdk/openai-v6';
import { createOpenAI as openaiV7 } from '@ai-sdk/openai-v7';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AISDKV5LanguageModel } from './v5/model';
import { AISDKV6LanguageModel } from './v6/model';
import { AISDKV7LanguageModel } from './v7/model';

let baseURL: string;
const server = createServer(async (req, res) => {
  let body = '';
  for await (const chunk of req) body += chunk;
  const request = JSON.parse(body);
  const [marker, charge] = request.model.split(':');
  if (marker === 'customer') res.setHeader('x-gateway-cost-source', 'customer-v1');
  const usage = {
    prompt_tokens: 1000,
    completion_tokens: 50,
    total_tokens: 1050,
    ...(charge === 'missing' ? {} : { cost: Number(charge) }),
  };
  const common = { id: 'completion', created: 1795737600, model: 'gpt-4o' };
  if (!request.stream) {
    res.setHeader('content-type', 'application/json');
    res.end(
      JSON.stringify({
        ...common,
        object: 'chat.completion',
        usage,
        choices: [{ index: 0, message: { role: 'assistant', content: 'hello' }, finish_reason: 'stop' }],
      }),
    );
    return;
  }
  res.setHeader('content-type', 'text/event-stream');
  const frame = (value: unknown) => `data: ${JSON.stringify(value)}\n\n`;
  res.end(
    frame({
      ...common,
      object: 'chat.completion.chunk',
      choices: [{ index: 0, delta: { role: 'assistant', content: 'hello' }, finish_reason: null }],
    }) +
      frame({ ...common, object: 'chat.completion.chunk', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] }) +
      frame({ ...common, object: 'chat.completion.chunk', choices: [], usage }) +
      'data: [DONE]\n\n',
  );
});

beforeAll(async () => {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('missing local server address');
  baseURL = `http://127.0.0.1:${address.port}/v1`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
});

const clients = [
  { name: 'v5', model: (id: string) => new AISDKV5LanguageModel(openaiV5({ baseURL, apiKey: 'local' }).chat(id)) },
  { name: 'v6', model: (id: string) => new AISDKV6LanguageModel(openaiV6({ baseURL, apiKey: 'local' }).chat(id)) },
  { name: 'v7', model: (id: string) => new AISDKV7LanguageModel(openaiV7({ baseURL, apiKey: 'local' }).chat(id)) },
];

describe.each(clients)('Gateway customer charges with the native OpenAI $name adapter', ({ model }) => {
  it.each([false, true])('preserves the final charge without exposing raw responses, stream=%s', async stream => {
    for (const cost of [0.00309, 0.00709, 0]) {
      const client = model(`customer:${cost}`);
      const options = { prompt: [{ role: 'user' as const, content: [{ type: 'text' as const, text: 'hello' }] }] };
      const result = stream ? await client.doStream(options) : await client.doGenerate(options);
      const chunks = await Array.fromAsync(result.stream);
      const finish = chunks.find(chunk => chunk.type === 'finish');
      expect(finish?.providerMetadata).toMatchObject({ mastraGateway: { cost } });
      expect(chunks.some(chunk => chunk.type === 'raw')).toBe(false);
      expect(chunks.filter(chunk => chunk.type === 'text-delta')).toMatchObject([{ delta: 'hello' }]);
    }
  });

  it.each([false, true])('keeps absent and unmarked charges unknown, stream=%s', async stream => {
    for (const id of ['customer:missing', 'supplier:0.00309']) {
      const client = model(id);
      const options = { prompt: [{ role: 'user' as const, content: [{ type: 'text' as const, text: 'hello' }] }] };
      const result = stream ? await client.doStream(options) : await client.doGenerate(options);
      const chunks = await Array.fromAsync(result.stream);
      const finish = chunks.find(chunk => chunk.type === 'finish');
      expect(finish?.providerMetadata).not.toHaveProperty('mastraGateway');
      expect(chunks.some(chunk => chunk.type === 'raw')).toBe(false);
    }
  });
});
