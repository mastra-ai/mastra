import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { LanguageModelV4CallOptions } from '@ai-sdk/provider-v7';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ModelsDevGateway } from './models-dev.js';

describe('ModelsDevGateway OpenAI Responses requests', () => {
  let server: Server;
  let baseURL: string;
  let requestBody: Record<string, unknown> | undefined;

  beforeAll(async () => {
    server = createServer(async (request, response) => {
      let body = '';
      for await (const chunk of request) body += chunk;
      requestBody = JSON.parse(body);

      response.setHeader('content-type', 'application/json');
      response.end(
        JSON.stringify({
          id: 'resp_test',
          object: 'response',
          created_at: 1,
          status: 'completed',
          model: 'gpt-5.1',
          output: [
            {
              type: 'message',
              id: 'msg_test',
              status: 'completed',
              role: 'assistant',
              content: [{ type: 'output_text', text: 'ok', annotations: [] }],
            },
          ],
          usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
        }),
      );
    });

    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as AddressInfo;
    baseURL = `http://127.0.0.1:${address.port}/v1`;
  });

  afterAll(() => server.close());

  it('serializes compaction options for built-in OpenAI models', async () => {
    const gateway = new ModelsDevGateway({
      openai: {
        apiKeyEnvVar: 'OPENAI_API_KEY',
        name: 'OpenAI',
        models: ['gpt-5.1'],
        gateway: 'models.dev',
        url: baseURL,
      },
    });
    const model = await gateway.resolveLanguageModel({
      providerId: 'openai',
      modelId: 'gpt-5.1',
      apiKey: 'test-key',
    });

    if (model.specificationVersion !== 'v4') {
      throw new Error(`Expected a v4 OpenAI model, received ${model.specificationVersion}`);
    }

    await model.doGenerate({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }],
      providerOptions: {
        openai: {
          store: false,
          contextManagement: [{ type: 'compaction', compactThreshold: 10_000 }],
        },
      },
    } as LanguageModelV4CallOptions);

    expect(requestBody).toMatchObject({
      model: 'gpt-5.1',
      store: false,
      context_management: [{ type: 'compaction', compact_threshold: 10_000 }],
    });
  });
});
