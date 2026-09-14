import { createGoogleGenerativeAI } from '@ai-sdk/google-v7';
import { wrapLanguageModel } from '@internal/ai-v7';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ModelRouterLanguageModel } from '../../llm/model/router';
import { createTool } from '../../tools';
import { Agent } from '../agent';

// Intercept HTTP only: Google's provider, Mastra's router, and AI SDK's
// V2-to-V4 middleware adapter all execute their real implementations.
describe.each(['router', 'direct'] as const)('Agent usage through Google and SDK middleware (%s)', path => {
  it.each(['generate', 'stream'] as const)('preserves token counts through a tool turn with %s', async mode => {
    let requests = 0;
    const fetch = vi.fn<typeof globalThis.fetch>(async (_url, init) => {
      const first = requests++ === 0;
      const body = JSON.parse(String(init?.body));
      if (!first) {
        expect(body.contents).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              parts: expect.arrayContaining([expect.objectContaining({ functionResponse: expect.any(Object) })]),
            }),
          ]),
        );
      }
      const response = {
        candidates: [
          {
            content: {
              role: 'model',
              parts: first ? [{ functionCall: { name: 'lookup', args: {} } }] : [{ text: 'Done' }],
            },
            finishReason: 'STOP',
            index: 0,
          },
        ],
        usageMetadata: {
          promptTokenCount: first ? 100 : 200,
          candidatesTokenCount: first ? 15 : 25,
          thoughtsTokenCount: 5,
          cachedContentTokenCount: 30,
          totalTokenCount: first ? 120 : 230,
        },
      };
      return String(_url).includes('streamGenerateContent')
        ? new Response(`data: ${JSON.stringify(response)}\n\n`, { headers: { 'Content-Type': 'text/event-stream' } })
        : Response.json(response);
    });
    const google = createGoogleGenerativeAI({ apiKey: 'test-key', fetch });
    const router = new ModelRouterLanguageModel({ id: 'usage-test/google/gemini-2.5-flash' }, [
      {
        id: 'usage-test',
        name: 'Usage test',
        fetchProviders: async () => ({}),
        buildUrl: () => undefined,
        getApiKey: async () => 'test-key',
        resolveLanguageModel: () => google('gemini-2.5-flash'),
      },
    ]);
    const adaptedUsage: unknown[] = [];
    const model = wrapLanguageModel({
      model: path === 'router' ? router : google('gemini-2.5-flash'),
      middleware: {
        specificationVersion: 'v4',
        wrapGenerate: async ({ doGenerate }) => {
          const result = await doGenerate();
          adaptedUsage.push(result.usage);
          return result;
        },
        wrapStream: async ({ doStream }) => {
          const result = await doStream();
          return {
            ...result,
            stream: result.stream.pipeThrough(
              new TransformStream({
                transform(chunk, controller) {
                  if (chunk.type === 'finish') adaptedUsage.push(chunk.usage);
                  controller.enqueue(chunk);
                },
              }),
            ),
          };
        },
      },
    });
    const execute = vi.fn(async () => ({ value: 'ok' }));
    const agent = new Agent({
      id: `usage-${mode}`,
      name: 'Usage test',
      instructions: 'Use lookup then respond.',
      model,
      tools: {
        lookup: createTool({
          id: 'lookup',
          description: 'Look up a value',
          inputSchema: z.object({}),
          outputSchema: z.object({ value: z.string() }),
          execute,
        }),
      },
    });
    const result = await agent[mode]('Look up a value', { maxSteps: 2 });
    if ('fullStream' in result) await result.consumeStream();
    expect(requests).toBe(2);
    expect(execute).toHaveBeenCalledTimes(1);
    const providerUsage = [
      { inputTokens: { total: 100, cacheRead: 30 }, outputTokens: { total: 20, reasoning: 5 } },
      { inputTokens: { total: 200, cacheRead: 30 }, outputTokens: { total: 30, reasoning: 5 } },
    ];
    // The router advertises V2 but forwards nested V4 usage. SDK middleware
    // consequently adds another total wrapper; the direct provider is the control.
    expect(adaptedUsage).toMatchObject(
      path === 'router'
        ? providerUsage.map(usage => ({
            inputTokens: { total: usage.inputTokens },
            outputTokens: { total: usage.outputTokens },
          }))
        : providerUsage,
    );
    expect(await result.text).toBe('Done');
    expect((await result.steps).map(step => step.usage)).toMatchObject([
      { inputTokens: 100, outputTokens: 20, totalTokens: 120 },
      { inputTokens: 200, outputTokens: 30, totalTokens: 230 },
    ]);
    expect(await result.usage).toMatchObject({
      inputTokens: 300,
      outputTokens: 50,
      totalTokens: 350,
      cachedInputTokens: 60,
      reasoningTokens: 10,
    });
    expect(await result.totalUsage).toEqual(await result.usage);
  });
});
