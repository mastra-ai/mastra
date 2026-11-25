import { LLMock } from '@copilotkit/aimock';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAmazonBedrockGateway } from '../amazon-bedrock-gateway.js';

const MODEL_ID = 'us.anthropic.claude-opus-5';

let mock: LLMock;

beforeEach(async () => {
  mock = new LLMock({ port: 0 });
  // aimock streams Bedrock tool use the way Bedrock does: contentBlockStart carries
  // only toolUseId and name, and the input arrives in later contentBlockDelta events.
  mock.onMessage(/.*/, {
    toolCalls: [{ id: 'tooluse_1', name: 'execute_command', arguments: JSON.stringify({ command: 'ls -la' }) }],
  });
  await mock.start();

  vi.stubEnv('AWS_ENDPOINT_URL_BEDROCK_RUNTIME', mock.url);
  vi.stubEnv('AWS_REGION', 'us-east-1');
  vi.stubEnv('AWS_ACCESS_KEY_ID', 'test-access-key');
  vi.stubEnv('AWS_SECRET_ACCESS_KEY', 'test-secret-key');
  vi.stubEnv('AWS_BEARER_TOKEN_BEDROCK', '');
  vi.stubEnv('AWS_PROFILE', '');
});

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await mock.stop();
});

describe('Amazon Bedrock streaming tool calls', () => {
  it('emits the tool call when the tool-use start event has no input', async () => {
    const model = createAmazonBedrockGateway().resolveLanguageModel({
      modelId: MODEL_ID,
      providerId: 'amazon-bedrock',
      apiKey: 'aws-credential-chain',
    }) as any;

    const sent: Array<{ body: string; authorization: string | null }> = [];
    const realFetch = globalThis.fetch;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (typeof init?.body === 'string') {
        sent.push({ body: init.body, authorization: new Headers(init.headers).get('authorization') });
      }
      return realFetch(input, init);
    });

    const { stream } = await model.doStream({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'List the files' }] }],
      tools: [
        {
          type: 'function',
          name: 'execute_command',
          description: 'Run a shell command',
          inputSchema: {
            type: 'object',
            properties: { command: { type: 'string' } },
            required: ['command'],
          },
        },
      ],
    });

    const parts: any[] = [];
    for await (const part of stream) parts.push(part);

    expect(parts.filter(part => part.type === 'error')).toEqual([]);
    const toolCalls = parts.filter(part => part.type === 'tool-call');
    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0].toolName).toBe('execute_command');
    expect(JSON.parse(toolCalls[0].input)).toEqual({ command: 'ls -la' });

    const finish = parts.find(part => part.type === 'finish');
    expect(JSON.stringify(finish.finishReason)).toContain('tool-calls');

    const [request] = mock.getRequests();
    expect(request!.path).toBe(`/model/${encodeURIComponent(MODEL_ID)}/converse-stream`);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=test-access-key\//);
    expect(sent[0]!.body).toContain('"cachePoint":{"type":"default"}');
  });
});
