import { once } from 'node:events';
import { createServer } from 'node:http';
import type { IncomingHttpHeaders, Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { LanguageModelV4CallOptions, SharedV4Warning } from '@ai-sdk/provider-v7';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ModelsDevGateway } from './models-dev.js';

type Request = { path: string; headers: IncomingHttpHeaders; body: Record<string, unknown> };

// Exercise the actual router-selected provider over HTTP. Older v7 Mistral
// releases dropped reasoning effort for new model IDs that were not allowlisted.
describe.each(['generate', 'stream'] as const)('Mistral v7 %s reasoning requests', operation => {
  let server: Server;
  let baseURL: string;
  let requests: Request[];

  beforeEach(async () => {
    requests = [];
    server = createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const body = JSON.parse(Buffer.concat(chunks).toString()) as Record<string, unknown>;
      requests.push({ path: request.url!, headers: request.headers, body });
      const metadata = { id: 'mistral-response', created: 1, model: body.model };
      const usage = { prompt_tokens: 7, completion_tokens: 3, total_tokens: 10 };

      if (body.stream === true) {
        response.writeHead(200, { 'content-type': 'text/event-stream' });
        response.write(
          `data: ${JSON.stringify({
            ...metadata,
            choices: [{ index: 0, delta: { role: 'assistant', content: 'Mistral answer' }, finish_reason: null }],
          })}\n\n`,
        );
        response.write(
          `data: ${JSON.stringify({
            ...metadata,
            choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
            usage,
          })}\n\n`,
        );
        response.end('data: [DONE]\n\n');
      } else {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(
          JSON.stringify({
            ...metadata,
            object: 'chat.completion',
            choices: [{ index: 0, message: { role: 'assistant', content: 'Mistral answer' }, finish_reason: 'stop' }],
            usage,
          }),
        );
      }
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    baseURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/tenant/v1`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close(error => (error ? reject(error) : resolve()));
      server.closeAllConnections();
    });
  });

  async function send(modelId: string, options: Partial<LanguageModelV4CallOptions>) {
    const gateway = new ModelsDevGateway({
      mistral: {
        name: 'Mistral',
        gateway: 'models.dev',
        apiKeyEnvVar: 'MISTRAL_API_KEY',
        url: baseURL,
        models: [modelId],
      },
    });
    const model = await gateway.resolveLanguageModel({
      providerId: 'mistral',
      modelId,
      apiKey: 'tenant-mistral-key',
      headers: { 'x-tenant': 'mistral-tenant' },
    });
    if (model.specificationVersion !== 'v4') throw new Error('The model router must resolve the v7 Mistral adapter');
    const params: LanguageModelV4CallOptions = {
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Answer the question.' }] }],
      headers: { 'x-call': 'preserved' },
      ...options,
    };
    let warnings: SharedV4Warning[] = [];

    if (operation === 'generate') {
      const result = await model.doGenerate(params);
      expect(result.content).toContainEqual({ type: 'text', text: 'Mistral answer' });
      expect(result.finishReason.unified).toBe('stop');
      expect(result.usage).toMatchObject({ inputTokens: { total: 7 }, outputTokens: { total: 3 } });
      warnings = result.warnings;
    } else {
      const { stream } = await model.doStream(params);
      let text = '';
      let finished = false;
      for await (const part of stream) {
        if (part.type === 'error') throw new Error(String(part.error));
        if (part.type === 'stream-start') warnings = part.warnings;
        if (part.type === 'text-delta') text += part.delta;
        if (part.type === 'finish') {
          expect(part.finishReason.unified).toBe('stop');
          expect(part.usage).toMatchObject({ inputTokens: { total: 7 }, outputTokens: { total: 3 } });
          finished = true;
        }
      }
      expect(text).toBe('Mistral answer');
      expect(finished).toBe(true);
    }

    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      path: '/tenant/v1/chat/completions',
      headers: { authorization: 'Bearer tenant-mistral-key', 'x-tenant': 'mistral-tenant', 'x-call': 'preserved' },
      body: { model: modelId },
    });
    return { body: requests[0]!.body, warnings };
  }

  it.each([
    ['zai-glm-5-2', 'high', 'none'],
    ['private-mistral-reasoner', 'none', 'high'],
    ['mistral-medium-3.5', 'high', 'none'],
  ] as const)(
    'keeps explicit effort for %s over the portable reasoning setting',
    async (modelId, effort, reasoning) => {
      const { body } = await send(modelId, { reasoning, providerOptions: { mistral: { reasoningEffort: effort } } });
      expect(body.reasoning_effort).toBe(effort);
    },
  );

  it.each(['low', 'max'] as const)('sends GLM-5.3 its explicit %s effort', async reasoningEffort => {
    const { body } = await send('zai-glm-5-3', {
      reasoning: 'high',
      providerOptions: { mistral: { reasoningEffort } },
    });
    expect(body.reasoning_effort).toBe(reasoningEffort);
  });

  it('uses the lowest supported effort with a warning when GLM-5.3 cannot disable thinking', async () => {
    const { body, warnings } = await send('zai-glm-5-3', { reasoning: 'none' });
    expect(body.reasoning_effort).toBe('low');
    expect(warnings).toContainEqual(expect.objectContaining({ type: 'compatibility', feature: 'reasoning' }));
  });

  it('keeps known non-reasoning models free of unsupported effort', async () => {
    const { body, warnings } = await send('mistral-large-latest', { reasoning: 'high' });
    expect(body).not.toHaveProperty('reasoning_effort');
    expect(warnings).toContainEqual(expect.objectContaining({ type: 'unsupported', feature: 'reasoning' }));
  });
});
