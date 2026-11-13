import type { Server } from 'node:http';
import { createServer } from 'node:http';
import { createTool, isValidationError } from '@mastra/core/tools';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { MastraClient } from '../client';

/**
 * A client tool with `toModelOutput` whose arguments fail validation. (#30211)
 *
 * Client tools run in the browser, so `@mastra/client-js` applies their
 * `toModelOutput` locally and sends the mapped value to the server as
 * `providerOptions.mastra.modelOutput`, which then replaces the raw result in
 * the model prompt. When the tool's own `createTool` validation rejected the
 * model's arguments, `execute` resolves with a ValidationError. Mapping that
 * with a mapper written for successful output turned it into `{}`, so the
 * model never saw why its call failed. The client must send what failed,
 * tagged `error-json`, without the raw arguments the full error quotes, while
 * valid results, and results that only look like validation errors, keep
 * their mapping.
 *
 * A local HTTP server plays the Mastra server: it replays scripted agent
 * responses and records the request bodies the client actually sent.
 */

const TOOL_CALL_ID = 'call_lookup';

type Scripted = { kind: 'json'; body: unknown } | { kind: 'sse'; chunks: object[] };

const EMAIL = 'jane.doe@example.com';

function createLookupTool(output: unknown = { answer: '42', secret: 'internal-only' }) {
  const mapperCalls: unknown[] = [];
  const lookup = createTool({
    id: 'lookup',
    description: 'Look up an answer',
    inputSchema: z.object({ query: z.string().min(1) }),
    outputSchema: z.object({ answer: z.string(), secret: z.string() }),
    execute: async () => output as { answer: string; secret: string },
    toModelOutput: output => {
      mapperCalls.push(output);
      return { type: 'json', value: { answer: output.answer } };
    },
  });
  return { lookup, mapperCalls };
}

describe('client tool toModelOutput and validation errors (#30211)', () => {
  let server: Server;
  let baseUrl: string;
  let script: Scripted[];
  let received: Array<{ url: string; body: any }>;

  beforeEach(async () => {
    script = [];
    received = [];
    server = createServer(async (req, res) => {
      let body = '';
      for await (const chunk of req) body += chunk;
      received.push({ url: req.url ?? '', body: body ? JSON.parse(body) : undefined });
      const next = script.shift();
      if (!next) {
        res.writeHead(500).end('unscripted request');
        return;
      }
      if (next.kind === 'json') {
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(next.body));
        return;
      }
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      for (const chunk of next.chunks) res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      res.end('data: [DONE]\n\n');
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing HTTP address');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  });

  function agent() {
    return new MastraClient({ baseUrl, retries: 0 }).getAgent('agent-1');
  }

  /** The tool-result part the client sent back to the server on the continuation request. */
  function sentToolResult() {
    expect(received).toHaveLength(2);
    return (received[1]!.body.messages as Array<{ content?: unknown }>)
      .flatMap(message => (Array.isArray(message.content) ? message.content : []))
      .find(part => part.type === 'tool-result' && part.toolCallId === TOOL_CALL_ID);
  }

  function scriptGenerateCalling(args: Record<string, unknown>) {
    script.push(
      {
        kind: 'json',
        body: {
          finishReason: 'tool-calls',
          toolCalls: [{ payload: { toolCallId: TOOL_CALL_ID, toolName: 'lookup', args } }],
          response: {
            messages: [
              {
                role: 'assistant',
                content: [{ type: 'tool-call', toolCallId: TOOL_CALL_ID, toolName: 'lookup', args }],
              },
            ],
          },
          usage: { totalTokens: 2 },
        },
      },
      {
        kind: 'json',
        body: {
          finishReason: 'stop',
          response: { messages: [{ role: 'assistant', content: 'Done' }] },
          usage: { totalTokens: 3 },
        },
      },
    );
  }

  it('generate: sends the validation error, not a mapping of it, when the arguments are rejected', async () => {
    const { lookup, mapperCalls } = createLookupTool();
    scriptGenerateCalling({ query: '', note: EMAIL });

    await agent().generate('Look up the answer', { clientTools: { lookup } });

    expect(mapperCalls).toEqual([]);
    const part = sentToolResult();
    // The raw result keeps the full error for the app; the model gets the issues without the arguments.
    expect(isValidationError(part.result)).toBe(true);
    expect(part.result.message).toContain('Provided arguments');
    expect(part.providerOptions).toEqual({
      mastra: {
        modelOutput: {
          type: 'error-json',
          value: {
            error: true,
            message: expect.stringContaining('Tool input validation failed'),
            validationErrors: part.result.validationErrors,
          },
        },
      },
    });
    expect(JSON.stringify(part.providerOptions)).not.toContain(EMAIL);
  });

  it('generate: sends the failing output fields, not the output, when the output is rejected', async () => {
    const { lookup, mapperCalls } = createLookupTool({ answer: 42, secret: 'internal-only', email: EMAIL });
    scriptGenerateCalling({ query: 'meaning of life' });

    await agent().generate('Look up the answer', { clientTools: { lookup } });

    expect(mapperCalls).toEqual([]);
    const part = sentToolResult();
    expect(part.result.message).toContain(EMAIL);
    const modelOutput = part.providerOptions.mastra.modelOutput;
    expect(modelOutput.type).toBe('error-json');
    expect(modelOutput.value.message).toContain('Tool output validation failed');
    expect(modelOutput.value.message).toContain('answer');
    expect(JSON.stringify(modelOutput)).not.toContain(EMAIL);
  });

  it('generate: maps a valid result that only looks like a validation error', async () => {
    const lookalike = { error: true, message: `Upstream rejected ${EMAIL}`, validationErrors: {} };
    const mapperCalls: unknown[] = [];
    const proxy = createTool({
      id: 'lookup',
      description: 'Calls an upstream API',
      inputSchema: z.object({ query: z.string() }),
      execute: async () => lookalike,
      toModelOutput: output => {
        mapperCalls.push(output);
        return { type: 'text', value: 'The upstream API rejected the request.' };
      },
    });
    scriptGenerateCalling({ query: 'x' });

    await agent().generate('Look up the answer', { clientTools: { lookup: proxy } });

    expect(mapperCalls).toEqual([lookalike]);
    expect(sentToolResult().providerOptions).toEqual({
      mastra: { modelOutput: { type: 'text', value: 'The upstream API rejected the request.' } },
    });
  });

  it('generate: still maps a valid result, so fields the mapper drops never reach the model', async () => {
    const { lookup, mapperCalls } = createLookupTool();
    scriptGenerateCalling({ query: 'meaning of life' });

    await agent().generate('Look up the answer', { clientTools: { lookup } });

    expect(mapperCalls).toEqual([{ answer: '42', secret: 'internal-only' }]);
    expect(sentToolResult().providerOptions).toEqual({
      mastra: { modelOutput: { type: 'json', value: { answer: '42' } } },
    });
  });

  it('stream: sends the validation error itself, not a mapping of it, when the arguments are rejected', async () => {
    const { lookup, mapperCalls } = createLookupTool();
    script.push(
      {
        kind: 'sse',
        chunks: [
          { type: 'step-start', payload: { messageId: 'm1' } },
          { type: 'tool-call', payload: { toolCallId: TOOL_CALL_ID, toolName: 'lookup', args: { query: '' } } },
          { type: 'step-finish', payload: { stepResult: { isContinued: false } } },
          { type: 'finish', payload: { stepResult: { reason: 'tool-calls' }, usage: { totalTokens: 2 } } },
        ],
      },
      {
        kind: 'sse',
        chunks: [
          { type: 'step-start', payload: { messageId: 'm2' } },
          { type: 'text-delta', payload: { text: 'Retrying' } },
          { type: 'step-finish', payload: { stepResult: { isContinued: false } } },
          { type: 'finish', payload: { stepResult: { reason: 'stop' }, usage: { totalTokens: 3 } } },
        ],
      },
    );

    const response = await agent().stream('Look up the answer', { clientTools: { lookup } });
    await response.processDataStream({ onChunk: async () => {} });

    expect(mapperCalls).toEqual([]);
    const part = sentToolResult();
    expect(part.output.type).toBe('json');
    expect(isValidationError(part.output.value)).toBe(true);
    expect(part.providerOptions).toEqual({
      mastra: {
        modelOutput: {
          type: 'error-json',
          value: {
            error: true,
            message: expect.stringContaining('Tool input validation failed'),
            validationErrors: part.output.value.validationErrors,
          },
        },
      },
    });
    expect(part.providerOptions.mastra.modelOutput.value.message).not.toContain('Provided arguments');
  });
});
