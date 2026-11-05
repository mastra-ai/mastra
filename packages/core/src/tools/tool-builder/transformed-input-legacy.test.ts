import { createOpenAI } from '@ai-sdk/openai';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../agent';
import { useLoopScenarioAimock } from '../../loop/test-utils/aimock/aimock-scenario';
import { createTool } from '../tool';

/**
 * AI SDK v4 validates tool calls with the built tool's `parameters` and passes the returned value
 * to `execute` and into the step messages. That validator returned the decoded `URL`, so
 * `execute` rejected it and `generateLegacy` failed with `DataCloneError` when the AI SDK cloned
 * the messages (#27259). This happens even with the OpenAI schema compat layer.
 */
describe('generateLegacy with a tool whose input schema decodes the arguments', () => {
  const getMock = useLoopScenarioAimock();

  it('runs the tool with the decoded URL and records the arguments the model sent', async () => {
    const received: unknown[] = [];
    const llm = getMock();
    llm.on(
      { endpoint: 'chat', hasToolResult: false },
      { toolCalls: [{ name: 'fetch_page', arguments: { url: 'https://example.com/docs' } }] },
    );
    llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Fetched example.com/docs.' });

    const agent = new Agent({
      id: 'legacy-url-agent',
      name: 'Legacy URL agent',
      instructions: 'Fetch the page the user asks for.',
      model: createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` }).chat(
        'gpt-4o-mini',
      ),
      tools: {
        fetch_page: createTool({
          id: 'fetch_page',
          description: 'Fetch a web page',
          inputSchema: z.object({ url: z.string().transform(s => new URL(s)) }),
          execute: async ({ url }) => {
            received.push(url);
            return { host: url.host, path: url.pathname };
          },
        }),
      },
    });

    const result = await agent.generateLegacy('Fetch https://example.com/docs', { maxSteps: 2 });

    expect(result.text).toBe('Fetched example.com/docs.');
    expect(result.steps[0]!.toolCalls[0]!.args).toEqual({ url: 'https://example.com/docs' });
    expect(received).toHaveLength(1);
    expect(received[0]).toBeInstanceOf(URL);
    expect((received[0] as URL).href).toBe('https://example.com/docs');
  });
});
