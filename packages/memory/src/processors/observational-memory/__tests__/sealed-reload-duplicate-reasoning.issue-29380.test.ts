import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import { createOpenAI } from '@ai-sdk/openai-v5';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { Memory } from '../../../index';

type InputItem = { id?: string; type?: string; call_id?: string };
type RecordedRequest = { observer: boolean; status: number; duplicateIds: string[] };
type OutputItem =
  | { type: 'reasoning'; id: string; summary: { type: 'summary_text'; text: string }[] }
  | {
      type: 'message';
      id: string;
      role: 'assistant';
      content: { type: 'output_text'; text: string; annotations: [] }[];
    }
  | { type: 'function_call'; id: string; call_id: string; name: string; arguments: string; status: 'completed' };

function parseInput(body: string): { model: string; input: InputItem[] } {
  const parsed: unknown = JSON.parse(body);
  const schema = z.object({
    model: z.string(),
    input: z.array(
      z.object({ id: z.string().optional(), type: z.string().optional(), call_id: z.string().optional() }),
    ),
  });
  return schema.parse(parsed);
}

function message(id: string, text: string): OutputItem {
  return { type: 'message', id, role: 'assistant', content: [{ type: 'output_text', text, annotations: [] }] };
}

function functionCall(step: number, callId: string, name: string, args: object): OutputItem {
  return {
    type: 'function_call',
    id: `fc_script_${step}`,
    call_id: callId,
    name,
    arguments: JSON.stringify(args),
    status: 'completed',
  };
}

/**
 * Scripted OpenAI Responses server, ported from the #29380 fixture. Only the model is
 * scripted: the actor writes text ending in a newline and suspends in ask_user, then runs
 * two lookups in separate steps and suspends again. Like the real API, it answers HTTP 400
 * when a request repeats an input item id.
 */
async function startScriptedResponses() {
  const requests: RecordedRequest[] = [];
  const server = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    const { model, input } = parseInput(body);
    const observer = req.url?.startsWith('/observer') ?? false;
    const ids = input.flatMap(item => (item.id ? [item.id] : []));
    const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
    requests.push({ observer, status: duplicateIds.length ? 400 : 200, duplicateIds });

    if (duplicateIds.length) {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          error: {
            message: `Duplicate item found with id ${duplicateIds[0]}. Remove duplicate items from your input and try again.`,
            type: 'invalid_request_error',
            param: 'input',
            code: null,
          },
        }),
      );
      return;
    }

    const outputs = new Set(input.filter(item => item.type === 'function_call_output').map(item => item.call_id));
    const step = outputs.has('call_ask2')
      ? 5
      : outputs.has('call_lookup3')
        ? 4
        : outputs.has('call_lookup2')
          ? 3
          : outputs.has('call_ask1')
            ? 2
            : 1;

    const items: OutputItem[] = [];
    if (observer) {
      items.push(
        message(
          `msg_observer_${requests.length}`,
          '<observations>\n- User requested product calculations and follow-up.\n</observations>\n<current-task>Collect follow-up schedule.</current-task>\n<suggested-response>Ask the user for the schedule.</suggested-response>',
        ),
      );
    } else {
      items.push({ type: 'reasoning', id: `rs_script_${step}`, summary: [{ type: 'summary_text', text: '' }] });
      if (step === 1) {
        items.push(message('msg_script_1', 'The product is 391.\n'));
        items.push(functionCall(step, 'call_ask1', 'ask_user', { question: 'Enable follow-up?' }));
      } else if (step === 2 || step === 3) {
        items.push(functionCall(step, `call_lookup${step}`, 'lookup', { a: 17, b: 23 }));
      } else if (step === 4) {
        items.push(functionCall(step, 'call_ask2', 'ask_user', { question: 'What schedule?' }));
      } else {
        items.push(message('msg_script_5', 'Hourly follow-up recorded.'));
      }
    }

    res.writeHead(200, { 'content-type': 'text/event-stream' });
    let sequence = 0;
    const event = (type: string, value: object) =>
      res.write(`event: ${type}\ndata: ${JSON.stringify({ type, sequence_number: sequence++, ...value })}\n\n`);
    const responseId = `resp_script_${requests.length}`;
    event('response.created', { response: { id: responseId, created_at: Math.floor(Date.now() / 1000), model } });
    items.forEach((item, output_index) => {
      event('response.output_item.added', {
        output_index,
        item: item.type === 'function_call' ? { ...item, arguments: '' } : item,
      });
      if (item.type === 'message') {
        event('response.output_text.delta', {
          output_index,
          item_id: item.id,
          content_index: 0,
          delta: item.content[0]!.text,
        });
      }
      if (item.type === 'function_call') {
        event('response.function_call_arguments.delta', { output_index, item_id: item.id, delta: item.arguments });
      }
      event('response.output_item.done', { output_index, item });
    });
    event('response.completed', {
      response: {
        id: responseId,
        status: 'completed',
        output: items,
        usage: {
          input_tokens: 100,
          output_tokens: 100,
          total_tokens: 200,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens_details: { reasoning_tokens: 0 },
        },
      },
    });
    res.end();
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    close: () => new Promise<void>(resolve => server.close(() => resolve())),
  };
}

// Technical: observational memory seals the assistant message whose text ends in a newline.
// Memory trims that text when it saves the message, and on the second resume MessageList
// treated the recalled copy as new content, re-adding it under a new id with the same
// OpenAI reasoning item id. The next Responses request then failed with HTTP 400. (#29380)
describe('Agent with observational memory resumed twice after text ending in a newline (#29380)', () => {
  it('finishes the run without sending a reasoning item twice', async () => {
    const server = await startScriptedResponses();
    try {
      const provider = (kind: 'actor' | 'observer') =>
        createOpenAI({ apiKey: 'local-model-fixture', baseURL: `${server.url}/${kind}` });
      const storage = new InMemoryStore();
      const memory = new Memory({
        storage,
        options: {
          generateTitle: false,
          semanticRecall: false,
          observationalMemory: {
            scope: 'thread',
            model: provider('observer').responses('gpt-5-mini'),
            observation: { messageTokens: 10_000, bufferTokens: 100, bufferOnIdle: false },
            reflection: { observationTokens: 100_000 },
          },
        },
      });
      const agent = new Agent({
        id: 'follow-up-agent',
        name: 'follow-up-agent',
        instructions: 'Compute products and ask the user about follow-up.',
        model: provider('actor').responses('gpt-5'),
        memory,
        tools: {
          ask_user: createTool({
            id: 'ask_user',
            description: 'Ask the user and suspend until they answer.',
            inputSchema: z.object({ question: z.string() }),
            suspendSchema: z.object({ question: z.string() }),
            resumeSchema: z.object({ answer: z.string() }),
            execute: async (input, context) => context?.agent?.resumeData ?? context?.agent?.suspend(input),
          }),
          lookup: createTool({
            id: 'lookup',
            description: 'Compute a product.',
            inputSchema: z.object({ a: z.number(), b: z.number() }),
            execute: async ({ a, b }) => ({ product: a * b }),
          }),
        },
      });
      const mastra = new Mastra({ agents: { agent }, storage, logger: false });
      const registered = mastra.getAgent('agent');
      const options = {
        memory: { thread: 'follow-up-thread', resource: 'user' },
        maxSteps: 12,
        providerOptions: { openai: { store: true, reasoningSummary: 'auto', reasoningEffort: 'high' } },
      } as const;

      const consume = async (output: Awaited<ReturnType<typeof registered.stream>>) => {
        let suspendedToolCallId: string | undefined;
        for await (const chunk of output.fullStream) {
          if (chunk.type === 'tool-call-suspended') suspendedToolCallId = chunk.payload.toolCallId;
        }
        const text = await output.text;
        await memory.settled();
        return { suspendedToolCallId, text };
      };

      const first = await registered.stream('Start the calculation and follow-up sequence.', options);
      const firstRun = await consume(first);
      expect(firstRun.suspendedToolCallId).toBe('call_ask1');

      const second = await registered.resumeStream(
        { answer: 'Yes, set up follow-up' },
        { ...options, runId: first.runId, toolCallId: 'call_ask1' },
      );
      const secondRun = await consume(second);
      expect(secondRun.suspendedToolCallId).toBe('call_ask2');

      const final = await registered.resumeStream(
        { answer: 'Check hourly' },
        { ...options, runId: first.runId, toolCallId: 'call_ask2' },
      );
      const finalRun = await consume(final);

      const actorRequests = server.requests.filter(request => !request.observer);
      expect(actorRequests.flatMap(request => request.duplicateIds)).toEqual([]);
      expect(actorRequests.every(request => request.status === 200)).toBe(true);
      expect(finalRun.text).toContain('Hourly follow-up recorded.');
    } finally {
      await server.close();
    }
  }, 60_000);
});
