/**
 * AIMock Scenario: Anthropic "output format" prefill rejection recovery (#28635)
 *
 * Claude models before 4.6 accept an assistant prefill in plain text, so
 * TrailingAssistantGuard leaves them alone. Under native structured output
 * (`output_config.format`) Anthropic still refuses a request that ends on an
 * assistant turn:
 *
 *   "When using output format, pre-filling the `assistant` response is not supported."
 *
 * The default PrefillErrorHandler must recognize that 400 and retry with a
 * `continue` reminder, as it does for the other known prefill rejections.
 *
 * The model is `claude-sonnet-4-5` on `@ai-sdk/anthropic` v6, which is what
 * `anthropic/claude-sonnet-4-5` resolves to and which sends native
 * `output_config.format` for it. AIMock plays Anthropic over HTTP: a request
 * whose last message is an assistant turn gets Anthropic's real 400 body, and
 * anything else gets the structured answer. AIMock normalizes Anthropic requests
 * to chat format and drops `output_config`, so a pass-through `fetch` records
 * the raw wire bodies for the assertions.
 *
 * Runs call the agent directly because `runLoopScenario` only takes a string
 * prompt, and these runs need input that ends on an assistant turn: passed in to
 * `stream()` or `generate()` (the report's repro), or an empty `stream([])`
 * continuation over a thread whose history ends on the agent's answer (the
 * report's production case).
 */

import { createAnthropic } from '@ai-sdk/anthropic-v6';
import { expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import type { MessageListInput } from '../../../../agent/message-list';
import { MockMemory } from '../../../../memory/mock';
import {
  createSharedAgent,
  describeForAllEngines,
  isDurableEngineVariant,
  useLoopScenarioAimock,
} from '../aimock-scenario';

const ANTHROPIC_OUTPUT_FORMAT_PREFILL_ERROR =
  'Your API request included an `assistant` message in the final position, which would pre-fill the `assistant` response. When using output format, pre-filling the `assistant` response is not supported.';

const anthropicWireBody = z.object({
  messages: z.array(
    z.object({
      role: z.string(),
      content: z.array(z.object({ type: z.string(), text: z.string().optional() }).loose()),
    }),
  ),
  output_config: z
    .object({ format: z.object({ type: z.string() }).loose().optional() })
    .loose()
    .optional(),
});
type AnthropicWireBody = z.infer<typeof anthropicWireBody>;

type InputCase = {
  name: string;
  method: 'stream' | 'generate';
  /** Prepares the thread and returns the input for `agent.stream`. */
  prepare: (memory: MockMemory, thread: { threadId: string; resourceId: string }) => Promise<MessageListInput>;
};

const inputCases: InputCase[] = [
  {
    name: 'stream() with input ending on an assistant turn',
    method: 'stream',
    prepare: async () => [
      { role: 'user', content: 'Name a primary colour.' },
      { role: 'assistant', content: 'Red.' },
    ],
  },
  {
    name: 'generate() with input ending on an assistant turn',
    method: 'generate',
    prepare: async () => [
      { role: 'user', content: 'Name a primary colour.' },
      { role: 'assistant', content: 'Red.' },
    ],
  },
  {
    name: 'stream([]) continuing a thread that ends on the agent answer',
    method: 'stream',
    prepare: async (memory, { threadId, resourceId }) => {
      const now = Date.now();
      await memory.createThread({ threadId, resourceId });
      await memory.saveMessages({
        messages: (
          [
            ['user', 'Name a primary colour.'],
            ['assistant', 'Red.'],
          ] as const
        ).map(([role, text], index) => ({
          id: `${threadId}-${role}`,
          role,
          content: { format: 2 as const, parts: [{ type: 'text' as const, text }] },
          threadId,
          resourceId,
          createdAt: new Date(now - 2000 + index * 1000),
          type: 'text' as const,
        })),
      });
      return [];
    },
  },
];

function textOf(message: { content: { parts?: Array<{ type: string; text?: string }> } }) {
  return (message.content.parts ?? []).map(part => (part.type === 'text' ? part.text : '')).join('');
}

describeForAllEngines('AIMock loop scenario: Anthropic output-format prefill recovery', engine => {
  const getMock = useLoopScenarioAimock();

  it.each(inputCases)(
    'returns the structured answer when Claude 4.5 rejects a trailing assistant turn under structured output, $name (#28635)',
    async ({ name, method, prepare }) => {
      const llm = getMock();
      llm.on(
        { predicate: request => request.messages.at(-1)?.role === 'assistant' },
        {
          raw: {
            wire: 'anthropic',
            status: 400,
            json: {
              type: 'error',
              error: { type: 'invalid_request_error', message: ANTHROPIC_OUTPUT_FORMAT_PREFILL_ERROR },
            },
          },
        },
      );
      llm.on({}, { content: '{"answer":"Red"}' });

      const sentBodies: AnthropicWireBody[] = [];
      const anthropic = createAnthropic({
        apiKey: 'aimock-test-key',
        baseURL: `${llm.url.replace(/\/+$/, '')}/v1`,
        fetch: async (url, init) => {
          if (typeof init?.body !== 'string') throw new Error('expected a JSON string request body');
          sentBodies.push(anthropicWireBody.parse(JSON.parse(init.body)));
          return fetch(url, init);
        },
      });

      const memory = new MockMemory();
      // No errorProcessors: the agent's stock stability defaults must handle this.
      const { agent } = await createSharedAgent(llm, {
        engine,
        memory,
        model: () => anthropic('claude-sonnet-4-5'),
      });
      const thread = { threadId: `thread-output-format-prefill-${engine}-${name}`, resourceId: 'prefill-resource' };
      const input = await prepare(memory, thread);

      const options = {
        memory: { thread: thread.threadId, resource: thread.resourceId },
        structuredOutput: { schema: z.object({ answer: z.string() }) },
      };
      if (method === 'generate') {
        const output = await agent.generate(input, options);
        expect(output.error).toBeUndefined();
        expect(output.object).toEqual({ answer: 'Red' });
      } else {
        const result = await agent.stream(input, options);
        const output = isDurableEngineVariant(engine) ? result.output : result;
        await output.consumeStream();
        expect(await output.error).toBeUndefined();
        expect(await output.object).toEqual({ answer: 'Red' });
      }

      // First request: native output format, and Claude 4.5 keeps its prefill, so the guard leaves
      // the trailing assistant turn alone. Second request: the prefill handler's retry ends on a user
      // turn carrying the continue reminder.
      expect(sentBodies).toHaveLength(2);
      expect(sentBodies[0]!.output_config?.format?.type).toBe('json_schema');
      expect(sentBodies[0]!.messages.map(message => message.role)).toEqual(['user', 'assistant']);
      expect(sentBodies[1]!.messages.at(-1)).toMatchObject({
        role: 'user',
        content: [
          expect.objectContaining({
            type: 'text',
            text: expect.stringContaining('type="anthropic-prefill-processor-retry"'),
          }),
        ],
      });
      // Both requests reached the mock server: the rejected one, then the retry.
      expect(llm.getRequests().map(request => request.response.status)).toEqual([400, 200]);

      // The recovered run is saved without a terminal error part.
      await vi.waitFor(async () => {
        const { messages } = await memory.recall(thread);
        expect(messages.map(textOf).join('')).toContain('{"answer":"Red"}');
        expect(messages.flatMap(message => message.content.parts ?? []).filter(part => part.type === 'error')).toEqual(
          [],
        );
      });
    },
  );
});
