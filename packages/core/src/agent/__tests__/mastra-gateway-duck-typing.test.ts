import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModelRouterLanguageModel } from '../../llm/model/router';
import { Agent } from '../agent';

describe('mastra gateway duck typing', () => {
  it('does not warn when model exposes a mastra gatewayId without being a ModelRouterLanguageModel instance', async () => {
    const warn = vi.fn();

    const duckTypedGatewayModel = {
      specificationVersion: 'v2' as const,
      provider: 'openrouter',
      modelId: 'openai/gpt-4o',
      defaultObjectGenerationMode: 'json' as const,
      supportsStructuredOutputs: true,
      supportsImageUrls: true,
      gatewayId: 'mastra',
      async doGenerate() {
        return {
          content: [{ type: 'text' as const, text: 'ok' }],
          finishReason: 'stop' as const,
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      },
      async doStream() {
        return {
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: 'text-start', id: 'text-1' });
              controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'ok' });
              controller.enqueue({ type: 'text-end', id: 'text-1' });
              controller.enqueue({
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              });
              controller.close();
            },
          }),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      },
    };

    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'You are a helpful assistant.',
      model: duckTypedGatewayModel as any,
    });

    agent.__setLogger({
      debug: vi.fn(),
      info: vi.fn(),
      warn,
      error: vi.fn(),
      trace: vi.fn(),
    } as any);

    const result = await agent.generate('hello', {
      memory: {
        thread: { id: 'thread-1' },
        resource: 'resource-1',
      },
    });

    expect(result.text).toBe('ok');
    expect(warn).not.toHaveBeenCalledWith(
      'No memory is configured but resourceId and threadId were passed in args',
      expect.anything(),
    );
  });

  describe('with a Mastra gateway router model', () => {
    const WARNING = 'No memory is configured but resourceId and threadId were passed in args';

    afterEach(() => {
      vi.unstubAllEnvs();
      vi.restoreAllMocks();
    });

    function routerModel(apiKey: string) {
      vi.stubEnv('MASTRA_GATEWAY_API_KEY', apiKey);
      const model = new ModelRouterLanguageModel('mastra/openai/gpt-4o');
      expect(model.gatewayId).toBe('mastra');
      const respond = async () =>
        ({
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: 'text-start', id: 'text-1' });
              controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'ok' });
              controller.enqueue({ type: 'text-end', id: 'text-1' });
              controller.enqueue({
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              });
              controller.close();
            },
          }),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        }) as any;
      vi.spyOn(model, 'doStream').mockImplementation(respond);
      vi.spyOn(model, 'doGenerate').mockImplementation(respond);
      return model;
    }

    async function run(model: ModelRouterLanguageModel) {
      const warn = vi.fn();
      const debug = vi.fn();
      const agent = new Agent({
        id: 'test-agent',
        name: 'test-agent',
        instructions: 'You are a helpful assistant.',
        model,
      });
      agent.__setLogger({ debug, info: vi.fn(), warn, error: vi.fn(), trace: vi.fn() } as any);
      const result = await agent.generate('hello', {
        memory: { thread: { id: 'thread-1' }, resource: 'resource-1' },
      });
      return { result, warn, debug };
    }

    const settle = () => new Promise(resolve => setTimeout(resolve, 0));

    it('warns for an organization key, whose memory stays local', async () => {
      const { result, warn } = await run(routerModel('mskv2_org-key'));

      expect(result.text).toBe('ok');
      await vi.waitFor(() => expect(warn).toHaveBeenCalledWith(WARNING, { agent: 'test-agent' }));
    });

    it('does not warn for a project key, whose memory the gateway keeps', async () => {
      const model = routerModel('msk_0123456789abcdef0123456789abcdef');
      const check = vi.spyOn(model, 'isGatewayMemoryManaged');
      const { warn } = await run(model);

      await vi.waitFor(() => expect(check).toHaveBeenCalled());
      await expect(check.mock.results[0]!.value).resolves.toBe(true);
      await settle();
      expect(warn).not.toHaveBeenCalledWith(WARNING, expect.anything());
    });

    it('finishes the run and does not warn when the check fails', async () => {
      const model = routerModel('mskv2_org-key');
      const check = vi.spyOn(model, 'isGatewayMemoryManaged').mockRejectedValue(new Error('credential unavailable'));
      const { result, warn, debug } = await run(model);

      expect(result.text).toBe('ok');
      await vi.waitFor(() => expect(check).toHaveBeenCalled());
      await settle();
      expect(warn).not.toHaveBeenCalledWith(WARNING, expect.anything());
      expect(debug).toHaveBeenCalledWith('Could not tell whether the gateway manages memory for this model', {
        agent: 'test-agent',
        error: expect.objectContaining({ message: 'credential unavailable' }),
      });
    });

    it('does not wait for a slow check before running the model', async () => {
      const model = routerModel('mskv2_org-key');
      let release: ((value: boolean) => void) | undefined;
      vi.spyOn(model, 'isGatewayMemoryManaged').mockImplementation(
        () => new Promise<boolean>(resolve => (release = resolve)),
      );
      const { result, warn } = await run(model);

      expect(result.text).toBe('ok');
      expect(warn).not.toHaveBeenCalledWith(WARNING, expect.anything());
      expect(release).toBeDefined();
      release!(false);
      await vi.waitFor(() => expect(warn).toHaveBeenCalledWith(WARNING, { agent: 'test-agent' }));
    });
  });
});
