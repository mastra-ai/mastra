import { stepCountIs } from '@internal/ai-sdk-v5';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../../../memory/mock';
import type { Processor } from '../../../../processors';
import { RequestContext } from '../../../../request-context';
import type { ChunkType } from '../../../../stream/types';
import { createTool } from '../../../../tools';
import { createSharedAgent, runApprovalScenario, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * AIMock loop scenarios executed with the **evented workflow engine**
 * (`MASTRA_EVENTED_EXECUTION=true`).
 *
 * The evented engine processes workflow steps via an in-process event bus
 * (pub/sub) rather than direct function calls. This serialisation boundary
 * can surface regressions that the default (direct) engine hides:
 *
 * - Tool results must survive JSON round-trips through the event system.
 * - Cross-turn message ordering must be preserved after event dispatch.
 * - Suspend/resume must work when snapshot state crosses event boundaries.
 * - Error objects must survive serialisation (Error → plain object → Error).
 * - Concurrent tool execution correctness under evented step dispatch.
 *
 * Each scenario mirrors or extends an existing default-engine scenario to
 * confirm the evented path produces identical results where behaviour is
 * shared, and explicitly documents where evented semantics diverge.
 */
describe('AIMock loop scenarios (evented engine)', () => {
  beforeAll(() => {
    vi.stubEnv('MASTRA_EVENTED_EXECUTION', 'true');
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  // ── Core tool loop ──────────────────────────────────────────────────

  describe('multi-step tool loop', () => {
    const getMock = useLoopScenarioAimock();

    it('feeds the turn-1 tool result into the turn-2 model request', async () => {
      const lookupTool = createTool({
        id: 'lookup_status',
        description: 'Look up a status payload for a query.',
        inputSchema: z.object({ query: z.string() }),
        outputSchema: z.object({ status: z.string() }),
        execute: async ({ query }) => ({ status: `STATUS_OK:${query}` }),
      });

      const { output, requests } = await runLoopScenario({
        llm: getMock(),
        prompt: 'Look up the status for query alpha.',
        tools: { lookup_status: lookupTool },
        stopWhen: stepCountIs(5),
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call_lookup_alpha', name: 'lookup_status', arguments: { query: 'alpha' } }] },
          );
          llm.on(
            { endpoint: 'chat', toolCallId: 'call_lookup_alpha', hasToolResult: true },
            { content: 'The status for alpha is STATUS_OK:alpha.' },
          );
        },
      });

      expect(requests).toHaveLength(2);
      const text = await output.text;
      expect(text).toContain('STATUS_OK:alpha');

      const toolResults = await output.toolResults;
      expect(toolResults).toHaveLength(1);
      expect(toolResults[0]?.payload.toolName).toBe('lookup_status');

      const turn2Messages = requests[1]?.body?.messages ?? [];
      expect(JSON.stringify(turn2Messages)).toContain('STATUS_OK:alpha');

      const toolMessage = turn2Messages.find((m: any) => m.role === 'tool') as { tool_call_id?: string } | undefined;
      expect(toolMessage?.tool_call_id).toBe('call_lookup_alpha');
    });

    it('handles a long tool chain capped by maxSteps through evented dispatch', async () => {
      let executionCount = 0;

      const incrementTool = createTool({
        id: 'increment',
        description: 'Increments a counter',
        inputSchema: z.object({}),
        execute: async () => {
          executionCount++;
          return { count: executionCount };
        },
      });

      const { requests } = await runLoopScenario({
        llm: getMock(),
        prompt: 'Keep incrementing',
        tools: { increment: incrementTool },
        maxSteps: 5,
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call_inc_1', name: 'increment', arguments: {} }] },
          );
          llm.on(
            { endpoint: 'chat', hasToolResult: true },
            { toolCalls: [{ id: 'call_inc_more', name: 'increment', arguments: {} }] },
          );
        },
      });

      // maxSteps caps at exactly 5 model requests through the evented pipeline
      expect(requests).toHaveLength(5);
      expect(executionCount).toBe(5);
    });
  });

  // ── Cross-turn message ordering ─────────────────────────────────────

  describe('cross-turn message ordering', () => {
    const getMock = useLoopScenarioAimock();

    it('round-trips multiple parallel tool results with correct ids', async () => {
      const getCity = createTool({
        id: 'get_city',
        description: 'Return a city name.',
        inputSchema: z.object({}),
        outputSchema: z.object({ city: z.string() }),
        execute: async () => ({ city: 'CITY_PARIS' }),
      });

      const getTemp = createTool({
        id: 'get_temp',
        description: 'Return a temperature.',
        inputSchema: z.object({}),
        outputSchema: z.object({ temp: z.string() }),
        execute: async () => ({ temp: 'TEMP_21C' }),
      });

      const { requests, output } = await runLoopScenario({
        llm: getMock(),
        prompt: 'Get the city and temperature.',
        tools: { get_city: getCity, get_temp: getTemp },
        stopWhen: stepCountIs(5),
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            {
              toolCalls: [
                { id: 'call_city', name: 'get_city', arguments: {} },
                { id: 'call_temp', name: 'get_temp', arguments: {} },
              ],
            },
          );
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Done: CITY_PARIS at TEMP_21C.' });
        },
      });

      expect(requests).toHaveLength(2);

      const turn2Messages = requests[1]?.body?.messages ?? [];
      const toolMessages = turn2Messages.filter((m: any) => m.role === 'tool') as Array<{
        tool_call_id?: string;
        content?: unknown;
      }>;

      const idsToResults = new Map(toolMessages.map(m => [m.tool_call_id, JSON.stringify(m.content)] as const));
      expect(idsToResults.has('call_city')).toBe(true);
      expect(idsToResults.has('call_temp')).toBe(true);
      expect(idsToResults.get('call_city')).toContain('CITY_PARIS');
      expect(idsToResults.get('call_temp')).toContain('TEMP_21C');

      const text = await output.text;
      expect(text).toContain('CITY_PARIS');
      expect(text).toContain('TEMP_21C');
    });
  });

  // ── Tool execution errors (serialisation across event boundary) ─────

  describe('tool execution errors', () => {
    const getMock = useLoopScenarioAimock();

    it('feeds a thrown tool error back to the model across the event boundary', async () => {
      const flakyTool = createTool({
        id: 'flaky',
        description: 'A tool that always throws.',
        inputSchema: z.object({}),
        outputSchema: z.object({ ok: z.boolean() }),
        execute: async () => {
          throw new Error('EVENTED_TOOL_BOOM');
        },
      });

      const { output, requests } = await runLoopScenario({
        llm: getMock(),
        prompt: 'Call the flaky tool.',
        tools: { flaky: flakyTool },
        stopWhen: stepCountIs(5),
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call_flaky', name: 'flaky', arguments: {} }] },
          );
          llm.on(
            { endpoint: 'chat', toolCallId: 'call_flaky', hasToolResult: true },
            { content: 'The tool failed, so I recovered gracefully.' },
          );
        },
      });

      const text = await output.text;
      expect(text).toContain('recovered gracefully');
      expect(requests).toHaveLength(2);

      const turn2Messages = requests[1]?.body?.messages ?? [];
      const toolMessage = turn2Messages.find((m: any) => m.role === 'tool') as
        | {
            tool_call_id?: string;
            content?: unknown;
          }
        | undefined;
      expect(toolMessage?.tool_call_id).toBe('call_flaky');
      // Error message survives serialisation through the event bus
      expect(JSON.stringify(toolMessage?.content)).toMatch(/error|fail|boom/i);
    });

    it('rejects an unknown tool and reports it back through the event boundary', async () => {
      const realTool = createTool({
        id: 'real_tool',
        description: 'A real registered tool.',
        inputSchema: z.object({}),
        outputSchema: z.object({ ok: z.boolean() }),
        execute: async () => ({ ok: true }),
      });

      const { output, requests } = await runLoopScenario({
        llm: getMock(),
        prompt: 'Call a tool.',
        tools: { real_tool: realTool },
        stopWhen: stepCountIs(5),
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call_ghost', name: 'nonexistent_tool', arguments: {} }] },
          );
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'That tool does not exist.' });
        },
      });

      expect(requests).toHaveLength(2);
      const turn2Messages = requests[1]?.body?.messages ?? [];
      const toolMessage = turn2Messages.find((m: any) => m.role === 'tool') as
        | {
            tool_call_id?: string;
          }
        | undefined;
      expect(toolMessage?.tool_call_id).toBe('call_ghost');

      const text = await output.text;
      expect(text).toContain('does not exist');
    });
  });

  // ── Structured output ───────────────────────────────────────────────

  describe('structured output', () => {
    const getMock = useLoopScenarioAimock();

    it('returns a schema-valid object after a tool turn', async () => {
      const lookupTool = createTool({
        id: 'lookup_status',
        description: 'Look up a status payload for a query.',
        inputSchema: z.object({ query: z.string() }),
        outputSchema: z.object({ status: z.string() }),
        execute: async ({ query }) => ({ status: `STATUS_OK:${query}` }),
      });

      const schema = z.object({
        query: z.string(),
        status: z.string(),
      });

      const { output, requests } = await runLoopScenario({
        llm: getMock(),
        prompt: 'Look up alpha and report the structured result.',
        tools: { lookup_status: lookupTool },
        stopWhen: stepCountIs(5),
        structuredOutput: { schema },
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call_lookup_alpha', name: 'lookup_status', arguments: { query: 'alpha' } }] },
          );
          llm.on(
            { endpoint: 'chat', hasToolResult: true },
            { content: JSON.stringify({ query: 'alpha', status: 'STATUS_OK:alpha' }) },
          );
        },
      });

      expect(requests.length).toBeGreaterThanOrEqual(2);

      const turn2Messages = (requests[1]?.body as any)?.messages ?? [];
      const toolMessage = turn2Messages.find((m: any) => m.role === 'tool');
      expect(JSON.stringify(toolMessage?.content)).toContain('STATUS_OK:alpha');

      const object = await (output as unknown as { object: Promise<unknown> }).object;
      expect(schema.parse(object)).toEqual({ query: 'alpha', status: 'STATUS_OK:alpha' });
    });
  });

  // ── Text streaming fidelity ─────────────────────────────────────────

  describe('text streaming fidelity', () => {
    const getMock = useLoopScenarioAimock();

    it('reassembles multi-delta text in order through the evented pipeline', async () => {
      const scriptedText = 'The evented engine preserves delta ordering through event dispatch.';

      const { output, chunks } = await runLoopScenario({
        llm: getMock(),
        prompt: 'Write a sentence.',
        stopWhen: stepCountIs(2),
        collectChunks: true,
        fixtures: llm => {
          llm.on({ endpoint: 'chat' }, { content: scriptedText });
        },
      });

      expect(chunks).toBeDefined();

      const textDeltas = chunks!.filter(
        (c): c is Extract<ChunkType, { type: 'text-delta' }> => c.type === 'text-delta',
      );
      expect(textDeltas.length).toBeGreaterThan(0);

      for (const delta of textDeltas) {
        expect(delta.payload).toBeTruthy();
        expect(typeof delta.payload.text).toBe('string');
        expect(delta.payload.text.length).toBeGreaterThan(0);
      }

      const reassembled = textDeltas.map(d => d.payload.text).join('');
      const finalText = await (output as unknown as { text: Promise<string> }).text;
      expect(reassembled).toBe(finalText);
      expect(finalText).toBe(scriptedText);
    });

    it('emits start/finish lifecycle chunks in correct order', async () => {
      const { chunks } = await runLoopScenario({
        llm: getMock(),
        prompt: 'Test lifecycle ordering.',
        stopWhen: stepCountIs(2),
        collectChunks: true,
        fixtures: llm => {
          llm.on({ endpoint: 'chat' }, { content: 'Lifecycle test.' });
        },
      });

      expect(chunks).toBeDefined();
      const types = chunks!.map(c => c.type);

      expect(types[0]).toBe('start');
      expect(types[types.length - 1]).toBe('finish');

      const firstStepStart = types.indexOf('step-start');
      const firstTextDelta = types.indexOf('text-delta');
      expect(firstStepStart).toBeGreaterThanOrEqual(0);
      expect(firstTextDelta).toBeGreaterThan(firstStepStart);
    });
  });

  // ── Memory and conversation history ─────────────────────────────────

  describe('memory conversation history', () => {
    const getMock = useLoopScenarioAimock();

    it('recalls prior thread messages into the next request', async () => {
      const memory = new MockMemory();
      const threadId = 'evented-memory-thread';
      const resourceId = 'evented-memory-resource';

      await memory.saveThread({
        thread: {
          id: threadId,
          title: 'Evented History Thread',
          resourceId,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      await runLoopScenario({
        llm: getMock(),
        prompt: 'My favorite number is EVENTED_42.',
        memory,
        threadId,
        resourceId,
        fixtures: llm => {
          llm.on({ endpoint: 'chat' }, { content: 'Got it, I will remember that.' });
        },
      });

      getMock().clearRequests();
      getMock().clearFixtures();
      getMock().resetMatchCounts();

      const { requests, output } = await runLoopScenario({
        llm: getMock(),
        prompt: 'What is my favorite number?',
        memory,
        threadId,
        resourceId,
        fixtures: llm => {
          llm.on({ endpoint: 'chat' }, { content: 'Your favorite number is EVENTED_42.' });
        },
      });

      expect(requests).toHaveLength(1);

      const serialized = JSON.stringify(requests[0]?.body?.messages ?? []);
      expect(serialized).toContain('EVENTED_42');
      expect(serialized).toContain('What is my favorite number?');

      const text = await output.text;
      expect(text).toContain('EVENTED_42');
    });
  });

  // ── Approval / suspend-resume ───────────────────────────────────────

  describe('tool approval suspend/resume', () => {
    const getMock = useLoopScenarioAimock();

    it('approves a suspended tool call, executes it, then completes', async () => {
      const makeLookupTool = () =>
        createTool({
          id: 'lookup_status',
          description: 'Look up a status payload for a query.',
          inputSchema: z.object({ query: z.string() }),
          outputSchema: z.object({ status: z.string() }),
          execute: async ({ query }) => ({ status: `STATUS_OK:${query}` }),
        });

      const { output, chunks, approvals, requests } = await runApprovalScenario({
        llm: getMock(),
        prompt: 'Look up the status for query alpha.',
        tools: { lookup_status: makeLookupTool() },
        stopWhen: stepCountIs(5),
        decision: () => true,
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call_lookup_alpha', name: 'lookup_status', arguments: { query: 'alpha' } }] },
          );
          llm.on(
            { endpoint: 'chat', toolCallId: 'call_lookup_alpha', hasToolResult: true },
            { content: 'The status for alpha is STATUS_OK:alpha.' },
          );
        },
      });

      expect(approvals).toEqual(['approve:call_lookup_alpha']);
      expect(chunks.some(chunk => chunk.type === 'tool-call-approval')).toBe(true);

      const text = await output.text;
      expect(text).toContain('STATUS_OK:alpha');
      expect(requests).toHaveLength(2);

      const turn2Messages = requests[1]?.body?.messages ?? [];
      const toolMessage = turn2Messages.find((m: any) => m.role === 'tool') as { tool_call_id?: string } | undefined;
      expect(toolMessage?.tool_call_id).toBe('call_lookup_alpha');
    });

    it('declines a suspended tool call and reports the denial back', async () => {
      const makeLookupTool = () =>
        createTool({
          id: 'lookup_status',
          description: 'Look up a status payload for a query.',
          inputSchema: z.object({ query: z.string() }),
          outputSchema: z.object({ status: z.string() }),
          execute: async ({ query }) => ({ status: `STATUS_OK:${query}` }),
        });

      const { output, approvals, requests } = await runApprovalScenario({
        llm: getMock(),
        prompt: 'Look up the status for query beta.',
        tools: { lookup_status: makeLookupTool() },
        stopWhen: stepCountIs(5),
        decision: () => false,
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call_lookup_beta', name: 'lookup_status', arguments: { query: 'beta' } }] },
          );
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'I will not look that up.' });
        },
      });

      expect(approvals).toEqual(['decline:call_lookup_beta']);

      const turn2Messages = requests[1]?.body?.messages ?? [];
      expect(JSON.stringify(turn2Messages)).not.toContain('STATUS_OK:beta');

      const text = await output.text;
      expect(text).toContain('will not look that up');
    });
  });

  // ── Suspend/resume with complex state ───────────────────────────────

  describe('suspend/resume state integrity', () => {
    const getMock = useLoopScenarioAimock();

    it('preserves suspended tool arguments through the evented snapshot boundary', async () => {
      let receivedArgs: any = null;

      const complexTool = createTool({
        id: 'complex-op',
        description: 'Complex operation with nested parameters',
        inputSchema: z.object({
          name: z.string(),
          count: z.number(),
          nested: z.object({
            flag: z.boolean(),
            items: z.array(z.string()),
          }),
        }),
        suspendSchema: z.object({ message: z.string() }),
        resumeSchema: z.object({ approved: z.boolean() }),
        execute: async (inputData, context) => {
          if (!context?.agent?.resumeData) {
            return await context?.agent?.suspend({
              message: `Confirm: ${inputData.name} (${inputData.count} items)`,
            });
          }
          receivedArgs = inputData;
          return { success: true, processed: inputData.name };
        },
      });

      const sharedMemory = new MockMemory();
      const shared = await createSharedAgent(getMock(), {
        tools: { complexTool },
        memory: sharedMemory,
      });

      const threadId = 'evented-snapshot-integrity-thread';
      const resourceId = 'test-resource';

      const originalArgs = {
        name: 'evented-test-operation',
        count: 99,
        nested: {
          flag: true,
          items: ['alpha', 'beta', 'gamma'],
        },
      };

      const { output, chunks } = await runLoopScenario({
        llm: getMock(),
        sharedAgent: shared,
        prompt: 'Execute complex operation',
        memory: sharedMemory,
        threadId,
        resourceId,
        fixtures: llm => {
          llm.onMessage(/execute|complex/i, {
            toolCalls: [{ id: 'call-complex-1', name: 'complex-op', arguments: originalArgs }],
          });
        },
        collectChunks: true,
      });

      const suspendedChunks = chunks!.filter(c => c.type === 'tool-call-suspended');
      expect(suspendedChunks.length).toBeGreaterThan(0);

      const suspendedToolCallId = (suspendedChunks[0] as any).payload.toolCallId;
      expect(suspendedToolCallId).toBe('call-complex-1');

      const resumeResult = await shared.agent.resumeStream(
        { approved: true },
        { runId: output.runId, toolCallId: suspendedToolCallId },
      );

      for await (const _chunk of resumeResult.fullStream) {
        // drain
      }

      // Arguments survived evented serialisation + snapshot boundary
      expect(receivedArgs).toBeDefined();
      expect(receivedArgs.name).toBe('evented-test-operation');
      expect(receivedArgs.count).toBe(99);
      expect(receivedArgs.nested.flag).toBe(true);
      expect(receivedArgs.nested.items).toEqual(['alpha', 'beta', 'gamma']);
    });
  });

  // ── Stop conditions ─────────────────────────────────────────────────

  describe('stop conditions', () => {
    const getMock = useLoopScenarioAimock();

    it('respects stepCountIs boundary with evented dispatch', async () => {
      let executionCount = 0;

      const counter = createTool({
        id: 'counter',
        description: 'Counts up.',
        inputSchema: z.object({}),
        execute: async () => {
          executionCount++;
          return { count: executionCount };
        },
      });

      const { requests } = await runLoopScenario({
        llm: getMock(),
        prompt: 'Count three times.',
        tools: { counter },
        stopWhen: stepCountIs(3),
        fixtures: llm => {
          llm.on({ endpoint: 'chat' }, { toolCalls: [{ id: 'call_cnt', name: 'counter', arguments: {} }] });
        },
      });

      // stepCountIs(3) halts at exactly 3 model requests
      expect(requests).toHaveLength(3);
      expect(executionCount).toBe(3);
    });

    it('model finishes before maxSteps is reached', async () => {
      const { output, requests } = await runLoopScenario({
        llm: getMock(),
        prompt: 'Say hello.',
        maxSteps: 10,
        fixtures: llm => {
          llm.on({ endpoint: 'chat' }, { content: 'Hello world.' });
        },
      });

      expect(requests).toHaveLength(1);
      const text = await output.text;
      expect(text).toBe('Hello world.');
    });
  });

  // ── Provider error handling ─────────────────────────────────────────

  describe('provider errors', () => {
    const getMock = useLoopScenarioAimock();

    it('surfaces a provider 500 as an error chunk through the evented pipeline', async () => {
      const { chunks } = await runLoopScenario({
        llm: getMock(),
        prompt: 'Trigger a provider error.',
        stopWhen: stepCountIs(2),
        collectChunks: true,
        fixtures: llm => {
          llm.on({ endpoint: 'chat' }, { error: { message: 'EVENTED_PROVIDER_ERROR' }, status: 500 });
        },
      });

      expect(chunks).toBeDefined();
      const errorChunks = chunks!.filter(c => c.type === 'error');
      expect(errorChunks.length).toBeGreaterThan(0);
    });
  });

  // ── Input processors ────────────────────────────────────────────────

  describe('input processors', () => {
    const getMock = useLoopScenarioAimock();

    it('redacts the user message before it reaches the model request', async () => {
      const redactInput: Processor = {
        id: 'redact-input-secret',
        processInput({ messages }) {
          return messages.map(message => {
            if (message.role !== 'user') return message;
            return {
              ...message,
              content: {
                ...message.content,
                parts: message.content.parts?.map(part => {
                  if (part.type === 'text' && 'text' in part && typeof part.text === 'string') {
                    return { ...part, text: part.text.replace(/EVENTED_SECRET/g, '[REDACTED]') };
                  }
                  return part;
                }),
              },
            };
          });
        },
      };

      const { requests, output } = await runLoopScenario({
        llm: getMock(),
        prompt: 'My password is EVENTED_SECRET, please acknowledge.',
        inputProcessors: [redactInput],
        fixtures: llm => {
          llm.on({ endpoint: 'chat' }, { content: 'Acknowledged.' });
        },
      });

      expect(requests).toHaveLength(1);
      const serialized = JSON.stringify(requests[0]?.body?.messages ?? []);
      expect(serialized).toContain('[REDACTED]');
      expect(serialized).not.toContain('EVENTED_SECRET');

      const text = await output.text;
      expect(text).toContain('Acknowledged.');
    });
  });

  // ── Guardrail tripwire ──────────────────────────────────────────────

  describe('guardrail tripwire', () => {
    const getMock = useLoopScenarioAimock();

    it('aborts before the model request when an input processor trips', async () => {
      const blockingProcessor: Processor = {
        id: 'blocking-guardrail',
        processInput: ({ messages, abort }) => {
          const text = JSON.stringify(messages);
          if (/forbidden/i.test(text)) {
            abort('blocked by guardrail');
          }
          return messages;
        },
      };

      const { output, requests } = await runLoopScenario({
        llm: getMock(),
        prompt: 'This message contains a forbidden phrase.',
        inputProcessors: [blockingProcessor],
        fixtures: llm => {
          llm.onMessage(/.*/, { content: 'The model should never run.' });
        },
      });

      const chunks: ChunkType[] = [];
      for await (const chunk of output.fullStream as AsyncIterable<ChunkType>) {
        chunks.push(chunk);
      }

      // The tripwire chunk carrying the abort reason
      const tripwire = chunks.find(chunk => chunk.type === 'tripwire');
      expect(tripwire, 'expected a tripwire chunk').toBeDefined();
      expect(JSON.stringify((tripwire as { payload?: unknown })?.payload)).toMatch(/blocked by guardrail/i);

      // The model provider was never reached
      expect(requests).toHaveLength(0);

      expect(await output.text).not.toContain('The model should never run.');
    });
  });

  // ── Request context passthrough ─────────────────────────────────────

  describe('request context passthrough', () => {
    const getMock = useLoopScenarioAimock();

    it('requestContext passes through to tool execute in evented mode', async () => {
      let capturedUserId: string | undefined;
      let capturedRole: string | undefined;

      const getUserData = createTool({
        id: 'get_user_data',
        description: 'Get user data based on request context',
        inputSchema: z.object({}),
        outputSchema: z.object({ userId: z.string(), role: z.string() }),
        execute: async (_input, context) => {
          capturedUserId = context?.requestContext?.get('userId');
          capturedRole = context?.requestContext?.get('role');
          return {
            userId: capturedUserId || 'unknown',
            role: capturedRole || 'unknown',
          };
        },
      });

      const requestContext = new RequestContext();
      requestContext.set('userId', 'evented-user-123');
      requestContext.set('role', 'admin');

      const { output, requests } = await runLoopScenario({
        llm: getMock(),
        prompt: 'Get my user data.',
        tools: { get_user_data: getUserData },
        stopWhen: stepCountIs(5),
        requestContext,
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call_user', name: 'get_user_data', arguments: {} }] },
          );
          llm.on(
            { endpoint: 'chat', hasToolResult: true },
            { content: 'Your user ID is evented-user-123 and your role is admin.' },
          );
        },
      });

      expect(capturedUserId).toBe('evented-user-123');
      expect(capturedRole).toBe('admin');
      expect(requests).toHaveLength(2);

      const text = await output.text;
      expect(text).toContain('evented-user-123');
    });
  });

  // ── Empty/no-tool turns ─────────────────────────────────────────────

  describe('empty/no-tool turns', () => {
    const getMock = useLoopScenarioAimock();

    it('completes immediately when model returns text without tool calls', async () => {
      const unusedTool = createTool({
        id: 'unused_tool',
        description: 'A tool that should not be called',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        execute: async () => ({}),
      });

      const { requests, output } = await runLoopScenario({
        llm: getMock(),
        prompt: 'Say hello',
        tools: { unused_tool: unusedTool },
        fixtures: llm => {
          llm.on({ endpoint: 'chat' }, { content: 'Hello! How can I help you?' });
        },
      });

      expect(requests).toHaveLength(1);
      const text = await output.text;
      expect(text).toContain('Hello');
    });

    it('handles empty string response gracefully in evented mode', async () => {
      const { requests, output } = await runLoopScenario({
        llm: getMock(),
        prompt: 'Return empty',
        fixtures: llm => {
          llm.on({ endpoint: 'chat' }, { content: '' });
        },
      });

      expect(requests).toHaveLength(1);
      const text = await output.text;
      expect(text).toBe('');
    });
  });

  // ── Evented-specific: tool result serialisation fidelity ────────────

  describe('evented-specific: serialisation fidelity', () => {
    const getMock = useLoopScenarioAimock();

    it('tool results with complex nested objects survive event bus serialisation', async () => {
      const complexResultTool = createTool({
        id: 'complex_result',
        description: 'Returns a complex nested result.',
        inputSchema: z.object({}),
        outputSchema: z.object({
          data: z.object({
            users: z.array(
              z.object({
                id: z.number(),
                name: z.string(),
                tags: z.array(z.string()),
              }),
            ),
            metadata: z.object({
              total: z.number(),
              page: z.number(),
            }),
          }),
        }),
        execute: async () => ({
          data: {
            users: [
              { id: 1, name: 'Alice', tags: ['admin', 'active'] },
              { id: 2, name: 'Bob', tags: ['user'] },
            ],
            metadata: { total: 2, page: 1 },
          },
        }),
      });

      const { output, requests } = await runLoopScenario({
        llm: getMock(),
        prompt: 'Get complex data.',
        tools: { complex_result: complexResultTool },
        stopWhen: stepCountIs(5),
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call_complex', name: 'complex_result', arguments: {} }] },
          );
          llm.on(
            { endpoint: 'chat', hasToolResult: true },
            { content: 'Found 2 users: Alice (admin, active) and Bob (user).' },
          );
        },
      });

      expect(requests).toHaveLength(2);

      // The nested tool result must survive serialisation through the event bus
      const turn2Serialized = JSON.stringify(requests[1]?.body?.messages ?? []);
      expect(turn2Serialized).toContain('Alice');
      expect(turn2Serialized).toContain('Bob');
      expect(turn2Serialized).toContain('admin');

      const text = await output.text;
      expect(text).toContain('Alice');
    });

    it('tool results with special characters survive serialisation', async () => {
      const specialCharTool = createTool({
        id: 'special_chars',
        description: 'Returns text with special characters.',
        inputSchema: z.object({}),
        outputSchema: z.object({ text: z.string() }),
        execute: async () => ({
          text: 'Line1\nLine2\tTabbed "quoted" \'single\' <html>&amp; backslash\\path',
        }),
      });

      const { requests } = await runLoopScenario({
        llm: getMock(),
        prompt: 'Get special text.',
        tools: { special_chars: specialCharTool },
        stopWhen: stepCountIs(5),
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call_special', name: 'special_chars', arguments: {} }] },
          );
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Got the special text.' });
        },
      });

      expect(requests).toHaveLength(2);
      const turn2Serialized = JSON.stringify(requests[1]?.body?.messages ?? []);
      // Key characters must survive the event bus
      expect(turn2Serialized).toContain('Line1');
      expect(turn2Serialized).toContain('Line2');
      expect(turn2Serialized).toContain('quoted');
      expect(turn2Serialized).toContain('backslash');
    });
  });

  // ── Evented-specific: concurrent tool execution ordering ────────────

  describe('evented-specific: concurrent tool execution', () => {
    const getMock = useLoopScenarioAimock();

    it('parallel tool calls in a single turn all execute and produce results', async () => {
      const executionOrder: string[] = [];

      const toolA = createTool({
        id: 'tool_a',
        description: 'Tool A.',
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
        execute: async () => {
          executionOrder.push('A');
          return { result: 'RESULT_A' };
        },
      });

      const toolB = createTool({
        id: 'tool_b',
        description: 'Tool B.',
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
        execute: async () => {
          executionOrder.push('B');
          return { result: 'RESULT_B' };
        },
      });

      const toolC = createTool({
        id: 'tool_c',
        description: 'Tool C.',
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
        execute: async () => {
          executionOrder.push('C');
          return { result: 'RESULT_C' };
        },
      });

      const { output, requests } = await runLoopScenario({
        llm: getMock(),
        prompt: 'Call all three tools.',
        tools: { tool_a: toolA, tool_b: toolB, tool_c: toolC },
        stopWhen: stepCountIs(5),
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            {
              toolCalls: [
                { id: 'call_a', name: 'tool_a', arguments: {} },
                { id: 'call_b', name: 'tool_b', arguments: {} },
                { id: 'call_c', name: 'tool_c', arguments: {} },
              ],
            },
          );
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'All tools returned results.' });
        },
      });

      expect(requests).toHaveLength(2);

      // All three tools executed
      expect(new Set(executionOrder)).toEqual(new Set(['A', 'B', 'C']));

      // All three results round-trip to the model
      const turn2Serialized = JSON.stringify(requests[1]?.body?.messages ?? []);
      expect(turn2Serialized).toContain('RESULT_A');
      expect(turn2Serialized).toContain('RESULT_B');
      expect(turn2Serialized).toContain('RESULT_C');

      const text = await output.text;
      expect(text).toContain('All tools returned results');
    });

    it('mixed success/failure in parallel tools: all results fed back to the model', async () => {
      const successTool = createTool({
        id: 'success_tool',
        description: 'Always succeeds.',
        inputSchema: z.object({}),
        outputSchema: z.object({ ok: z.boolean() }),
        execute: async () => ({ ok: true }),
      });

      const failTool = createTool({
        id: 'fail_tool',
        description: 'Always fails.',
        inputSchema: z.object({}),
        outputSchema: z.object({ ok: z.boolean() }),
        execute: async () => {
          throw new Error('EVENTED_PARALLEL_FAIL');
        },
      });

      const { requests } = await runLoopScenario({
        llm: getMock(),
        prompt: 'Call both tools.',
        tools: { success_tool: successTool, fail_tool: failTool },
        stopWhen: stepCountIs(5),
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            {
              toolCalls: [
                { id: 'call_success', name: 'success_tool', arguments: {} },
                { id: 'call_fail', name: 'fail_tool', arguments: {} },
              ],
            },
          );
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'One succeeded, one failed.' });
        },
      });

      expect(requests).toHaveLength(2);

      const turn2Messages = requests[1]?.body?.messages ?? [];
      const toolMessages = turn2Messages.filter((m: any) => m.role === 'tool') as Array<{
        tool_call_id?: string;
        content?: unknown;
      }>;

      // Both tool results (success and error) must appear
      const ids = toolMessages.map(m => m.tool_call_id);
      expect(ids).toContain('call_success');
      expect(ids).toContain('call_fail');

      // Success result contains the ok:true value
      const successMsg = toolMessages.find(m => m.tool_call_id === 'call_success');
      expect(JSON.stringify(successMsg?.content)).toContain('true');

      // Failure result contains error info
      const failMsg = toolMessages.find(m => m.tool_call_id === 'call_fail');
      expect(JSON.stringify(failMsg?.content)).toMatch(/error|fail/i);
    });
  });

  // ── Evented-specific: multi-turn accumulation ───────────────────────

  describe('evented-specific: multi-turn state persistence', () => {
    const getMock = useLoopScenarioAimock();

    it('sequential tool calls accumulate results across turns', async () => {
      const fetchTool = createTool({
        id: 'fetch_data',
        description: 'Fetch data by key.',
        inputSchema: z.object({ key: z.string() }),
        outputSchema: z.object({ value: z.string() }),
        execute: async ({ key }) => ({ value: `VALUE_${key.toUpperCase()}` }),
      });

      const { requests } = await runLoopScenario({
        llm: getMock(),
        prompt: 'Fetch data for keys alpha and beta.',
        tools: { fetch_data: fetchTool },
        stopWhen: stepCountIs(10),
        fixtures: llm => {
          // Turn 1: no tool result yet → fetch alpha
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call_alpha', name: 'fetch_data', arguments: { key: 'alpha' } }] },
          );
          // Turn 2: alpha result present → fetch beta
          llm.on(
            { endpoint: 'chat', toolCallId: 'call_alpha', hasToolResult: true },
            { toolCalls: [{ id: 'call_beta', name: 'fetch_data', arguments: { key: 'beta' } }] },
          );
          // Turn 3: beta result present → produce final text
          llm.on(
            { endpoint: 'chat', toolCallId: 'call_beta', hasToolResult: true },
            { content: 'Alpha is VALUE_ALPHA, Beta is VALUE_BETA.' },
          );
        },
      });

      expect(requests).toHaveLength(3);

      // Turn 2 carries alpha's result
      expect(JSON.stringify(requests[1]?.body?.messages ?? [])).toContain('VALUE_ALPHA');

      // Turn 3 carries beta's result and alpha's history
      const turn3Serialized = JSON.stringify(requests[2]?.body?.messages ?? []);
      expect(turn3Serialized).toContain('VALUE_BETA');
      expect(turn3Serialized).toContain('VALUE_ALPHA');
    });
  });

  // ── Evented-specific: model settings passthrough ────────────────────

  describe('evented-specific: model settings', () => {
    const getMock = useLoopScenarioAimock();

    it('modelSettings survive evented dispatch and land in the request body', async () => {
      const { requests } = await runLoopScenario({
        llm: getMock(),
        prompt: 'Test settings.',
        maxSteps: 2,
        modelSettings: { temperature: 0.5 },
        fixtures: llm => {
          llm.on({ endpoint: 'chat' }, { content: 'Done.' });
        },
      });

      expect(requests).toHaveLength(1);
      expect((requests[0]?.body as any)?.temperature).toBe(0.5);
    });
  });

  // ── Rich-type shape scenarios ─────────────────────────────────────────
  //
  // These scenarios verify that tool results containing shapes corresponding
  // to the rich types supported by the UnixSocketPubSub codec (PR #17836) —
  // Date, Error, Map, Set, RegExp, URL, BigInt, undefined — flow through the
  // evented agentic loop and arrive intact in the next model request.
  //
  // Today the EventEmitterPubSub in-process path passes objects by reference
  // (no serialisation), so these pass trivially. Once the codec path is wired
  // in (cross-process UnixSocketPubSub), these same scenarios guard against
  // codec regressions that break the agentic loop end-to-end.

  describe('rich-type shapes: Date', () => {
    const getMock = useLoopScenarioAimock();

    it('Date objects in tool results round-trip through the evented loop', async () => {
      const now = new Date('2026-06-22T12:00:00.000Z');
      const past = new Date('2020-01-15T08:30:00.000Z');

      const dateTool = createTool({
        id: 'date_tool',
        description: 'Returns dates.',
        inputSchema: z.object({}),
        outputSchema: z.object({
          createdAt: z.string(),
          updatedAt: z.string(),
          events: z.array(z.object({ label: z.string(), when: z.string() })),
        }),
        execute: async () => ({
          createdAt: past.toISOString(),
          updatedAt: now.toISOString(),
          events: [
            { label: 'registered', when: past.toISOString() },
            { label: 'last_login', when: now.toISOString() },
          ],
        }),
      });

      const { requests } = await runLoopScenario({
        llm: getMock(),
        prompt: 'Get dates.',
        tools: { date_tool: dateTool },
        stopWhen: stepCountIs(5),
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call_date', name: 'date_tool', arguments: {} }] },
          );
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Dates received.' });
        },
      });

      expect(requests).toHaveLength(2);
      const turn2 = JSON.stringify(requests[1]?.body?.messages ?? []);
      expect(turn2).toContain('2026-06-22T12:00:00.000Z');
      expect(turn2).toContain('2020-01-15T08:30:00.000Z');
      expect(turn2).toContain('registered');
      expect(turn2).toContain('last_login');
    });
  });

  describe('rich-type shapes: Error-like objects', () => {
    const getMock = useLoopScenarioAimock();

    it('error-like tool results with message, name, and cause chain survive the loop', async () => {
      const errorTool = createTool({
        id: 'error_info_tool',
        description: 'Returns error diagnostics.',
        inputSchema: z.object({}),
        outputSchema: z.object({
          errors: z.array(
            z.object({
              name: z.string(),
              message: z.string(),
              code: z.string().optional(),
              cause: z.string().optional(),
            }),
          ),
        }),
        execute: async () => ({
          errors: [
            { name: 'ValidationError', message: 'field "email" is required', code: 'E_VALIDATION' },
            {
              name: 'NetworkError',
              message: 'connection refused',
              code: 'E_CONN_REFUSED',
              cause: 'DNS lookup failed for api.example.com',
            },
          ],
        }),
      });

      const { requests } = await runLoopScenario({
        llm: getMock(),
        prompt: 'Get error info.',
        tools: { error_info_tool: errorTool },
        stopWhen: stepCountIs(5),
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call_err', name: 'error_info_tool', arguments: {} }] },
          );
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Errors received.' });
        },
      });

      expect(requests).toHaveLength(2);
      const turn2 = JSON.stringify(requests[1]?.body?.messages ?? []);
      expect(turn2).toContain('ValidationError');
      expect(turn2).toContain('email');
      expect(turn2).toContain('is required');
      expect(turn2).toContain('E_VALIDATION');
      expect(turn2).toContain('NetworkError');
      expect(turn2).toContain('connection refused');
      expect(turn2).toContain('DNS lookup failed');
    });
  });

  describe('rich-type shapes: Map-like key-value pairs', () => {
    const getMock = useLoopScenarioAimock();

    it('Map-shaped entries (array-of-pairs) survive the evented loop', async () => {
      const mapTool = createTool({
        id: 'map_tool',
        description: 'Returns key-value data.',
        inputSchema: z.object({}),
        outputSchema: z.object({
          entries: z.array(z.tuple([z.string(), z.number()])),
          nestedEntries: z.array(z.tuple([z.string(), z.object({ score: z.number(), tags: z.array(z.string()) })])),
        }),
        execute: async () => ({
          entries: [
            ['alpha', 100],
            ['beta', 200],
            ['gamma', 300],
          ] as [string, number][],
          nestedEntries: [
            ['user-1', { score: 95, tags: ['admin', 'active'] }],
            ['user-2', { score: 72, tags: ['viewer'] }],
          ] as [string, { score: number; tags: string[] }][],
        }),
      });

      const { requests } = await runLoopScenario({
        llm: getMock(),
        prompt: 'Get map data.',
        tools: { map_tool: mapTool },
        stopWhen: stepCountIs(5),
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call_map', name: 'map_tool', arguments: {} }] },
          );
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Map data received.' });
        },
      });

      expect(requests).toHaveLength(2);
      const turn2 = JSON.stringify(requests[1]?.body?.messages ?? []);
      expect(turn2).toContain('alpha');
      expect(turn2).toContain('100');
      expect(turn2).toContain('beta');
      expect(turn2).toContain('200');
      expect(turn2).toContain('gamma');
      expect(turn2).toContain('300');
      expect(turn2).toContain('user-1');
      expect(turn2).toContain('admin');
    });
  });

  describe('rich-type shapes: Set-like unique arrays', () => {
    const getMock = useLoopScenarioAimock();

    it('Set-shaped arrays of unique values survive the evented loop', async () => {
      const setTool = createTool({
        id: 'set_tool',
        description: 'Returns unique collections.',
        inputSchema: z.object({}),
        outputSchema: z.object({
          tags: z.array(z.string()),
          ids: z.array(z.number()),
        }),
        execute: async () => ({
          tags: ['typescript', 'vitest', 'mastra', 'evented-engine', 'codec'],
          ids: [1001, 2002, 3003, 4004, 5005],
        }),
      });

      const { requests } = await runLoopScenario({
        llm: getMock(),
        prompt: 'Get unique collections.',
        tools: { set_tool: setTool },
        stopWhen: stepCountIs(5),
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call_set', name: 'set_tool', arguments: {} }] },
          );
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Sets received.' });
        },
      });

      expect(requests).toHaveLength(2);
      const turn2 = JSON.stringify(requests[1]?.body?.messages ?? []);
      expect(turn2).toContain('typescript');
      expect(turn2).toContain('mastra');
      expect(turn2).toContain('evented-engine');
      expect(turn2).toContain('codec');
      expect(turn2).toContain('1001');
      expect(turn2).toContain('5005');
    });
  });

  describe('rich-type shapes: RegExp-like pattern objects', () => {
    const getMock = useLoopScenarioAimock();

    it('regex pattern objects with source and flags survive the evented loop', async () => {
      const regexTool = createTool({
        id: 'regex_tool',
        description: 'Returns regex patterns.',
        inputSchema: z.object({}),
        outputSchema: z.object({
          patterns: z.array(z.object({ source: z.string(), flags: z.string(), description: z.string() })),
        }),
        execute: async () => ({
          patterns: [
            { source: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$', flags: 'i', description: 'email' },
            { source: '\\d{4}-\\d{2}-\\d{2}', flags: '', description: 'iso-date' },
            { source: '<script[^>]*>.*?</script>', flags: 'gis', description: 'script-tag' },
          ],
        }),
      });

      const { requests } = await runLoopScenario({
        llm: getMock(),
        prompt: 'Get regex patterns.',
        tools: { regex_tool: regexTool },
        stopWhen: stepCountIs(5),
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call_regex', name: 'regex_tool', arguments: {} }] },
          );
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Patterns received.' });
        },
      });

      expect(requests).toHaveLength(2);
      const turn2 = JSON.stringify(requests[1]?.body?.messages ?? []);
      expect(turn2).toContain('email');
      expect(turn2).toContain('iso-date');
      expect(turn2).toContain('script-tag');
      expect(turn2).toContain('a-zA-Z0-9');
    });
  });

  describe('rich-type shapes: URL strings', () => {
    const getMock = useLoopScenarioAimock();

    it('URL strings with various schemes survive the evented loop', async () => {
      const urlTool = createTool({
        id: 'url_tool',
        description: 'Returns URLs.',
        inputSchema: z.object({}),
        outputSchema: z.object({
          urls: z.array(z.object({ href: z.string(), label: z.string() })),
        }),
        execute: async () => ({
          urls: [
            { href: 'https://example.com/path?query=value&foo=bar#section', label: 'web' },
            { href: 'file:///home/user/docs/readme.md', label: 'file' },
            { href: 'data:text/plain;base64,SGVsbG8=', label: 'data' },
            { href: 'wss://ws.example.com:8080/socket', label: 'websocket' },
          ],
        }),
      });

      const { requests } = await runLoopScenario({
        llm: getMock(),
        prompt: 'Get URLs.',
        tools: { url_tool: urlTool },
        stopWhen: stepCountIs(5),
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call_url', name: 'url_tool', arguments: {} }] },
          );
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'URLs received.' });
        },
      });

      expect(requests).toHaveLength(2);
      const turn2 = JSON.stringify(requests[1]?.body?.messages ?? []);
      expect(turn2).toContain('https://example.com/path?query=value&foo=bar#section');
      expect(turn2).toContain('file:///home/user/docs/readme.md');
      expect(turn2).toContain('data:text/plain;base64,SGVsbG8=');
      expect(turn2).toContain('wss://ws.example.com:8080/socket');
    });
  });

  describe('rich-type shapes: BigInt-range numbers', () => {
    const getMock = useLoopScenarioAimock();

    it('large numeric strings representing BigInt values survive the evented loop', async () => {
      const bigintTool = createTool({
        id: 'bigint_tool',
        description: 'Returns large numeric data.',
        inputSchema: z.object({}),
        outputSchema: z.object({
          values: z.array(z.object({ label: z.string(), value: z.string(), radix: z.string().optional() })),
        }),
        execute: async () => ({
          values: [
            { label: 'max-safe-plus-one', value: '9007199254740993' },
            { label: 'large-id', value: '18446744073709551615' },
            { label: 'negative-big', value: '-99999999999999999999' },
            { label: 'hex', value: '0xFFFFFFFFFFFFFFFF', radix: '16' },
          ],
        }),
      });

      const { requests } = await runLoopScenario({
        llm: getMock(),
        prompt: 'Get large numbers.',
        tools: { bigint_tool: bigintTool },
        stopWhen: stepCountIs(5),
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call_big', name: 'bigint_tool', arguments: {} }] },
          );
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Large numbers received.' });
        },
      });

      expect(requests).toHaveLength(2);
      const turn2 = JSON.stringify(requests[1]?.body?.messages ?? []);
      expect(turn2).toContain('9007199254740993');
      expect(turn2).toContain('18446744073709551615');
      expect(turn2).toContain('-99999999999999999999');
      expect(turn2).toContain('0xFFFFFFFFFFFFFFFF');
    });
  });

  describe('rich-type shapes: null and undefined handling', () => {
    const getMock = useLoopScenarioAimock();

    it('explicit nulls in tool results survive the evented loop', async () => {
      const nullTool = createTool({
        id: 'null_tool',
        description: 'Returns data with nulls.',
        inputSchema: z.object({}),
        outputSchema: z.object({
          present: z.string(),
          missing: z.null(),
          nested: z.object({
            value: z.string().nullable(),
            items: z.array(z.string().nullable()),
          }),
        }),
        execute: async () => ({
          present: 'has-value',
          missing: null,
          nested: {
            value: null,
            items: ['first', null, 'third'],
          },
        }),
      });

      const { requests } = await runLoopScenario({
        llm: getMock(),
        prompt: 'Get nullable data.',
        tools: { null_tool: nullTool },
        stopWhen: stepCountIs(5),
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call_null', name: 'null_tool', arguments: {} }] },
          );
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Nullable data received.' });
        },
      });

      expect(requests).toHaveLength(2);
      const turn2 = JSON.stringify(requests[1]?.body?.messages ?? []);
      expect(turn2).toContain('has-value');
      expect(turn2).toContain('null');
      expect(turn2).toContain('first');
      expect(turn2).toContain('third');
    });
  });

  describe('rich-type shapes: mixed payload', () => {
    const getMock = useLoopScenarioAimock();

    it('a single tool result combining all rich-type shapes survives the evented loop', async () => {
      const mixedTool = createTool({
        id: 'mixed_tool',
        description: 'Returns a payload with all rich-type shapes.',
        inputSchema: z.object({}),
        outputSchema: z.object({
          timestamp: z.string(),
          error: z.object({ name: z.string(), message: z.string(), cause: z.string().optional() }),
          mapEntries: z.array(z.tuple([z.string(), z.number()])),
          setValues: z.array(z.string()),
          pattern: z.object({ source: z.string(), flags: z.string() }),
          url: z.string(),
          bigValue: z.string(),
          nullableField: z.string().nullable(),
        }),
        execute: async () => ({
          timestamp: new Date('2026-06-22T12:00:00Z').toISOString(),
          error: { name: 'CodecTestError', message: 'rich-type round-trip', cause: 'inner cause' },
          mapEntries: [
            ['key-a', 1],
            ['key-b', 2],
          ] as [string, number][],
          setValues: ['unique-1', 'unique-2', 'unique-3'],
          pattern: { source: '\\d+\\.\\d+', flags: 'g' },
          url: 'https://mastra.ai/docs/codec?rich=true',
          bigValue: '9007199254740993',
          nullableField: null,
        }),
      });

      const { requests } = await runLoopScenario({
        llm: getMock(),
        prompt: 'Get mixed payload.',
        tools: { mixed_tool: mixedTool },
        stopWhen: stepCountIs(5),
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call_mixed', name: 'mixed_tool', arguments: {} }] },
          );
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Mixed payload received.' });
        },
      });

      expect(requests).toHaveLength(2);
      const turn2 = JSON.stringify(requests[1]?.body?.messages ?? []);
      // Date shape
      expect(turn2).toContain('2026-06-22T12:00:00');
      // Error shape
      expect(turn2).toContain('CodecTestError');
      expect(turn2).toContain('rich-type round-trip');
      expect(turn2).toContain('inner cause');
      // Map shape
      expect(turn2).toContain('key-a');
      expect(turn2).toContain('key-b');
      // Set shape
      expect(turn2).toContain('unique-1');
      expect(turn2).toContain('unique-3');
      // RegExp shape
      expect(turn2).toContain('\\d+');
      // URL shape
      expect(turn2).toContain('https://mastra.ai/docs/codec');
      // BigInt shape
      expect(turn2).toContain('9007199254740993');
      // null
      expect(turn2).toContain('null');
    });
  });

  // ── Evented-specific: onStepFinish callback ─────────────────────────

  describe('evented-specific: onStepFinish', () => {
    const getMock = useLoopScenarioAimock();

    it('onStepFinish fires for each step including tool-call steps', async () => {
      const stepResults: any[] = [];

      const tool = createTool({
        id: 'simple_tool',
        description: 'A simple tool.',
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
        execute: async () => ({ result: 'STEP_FINISH_RESULT' }),
      });

      await runLoopScenario({
        llm: getMock(),
        prompt: 'Call the tool.',
        tools: { simple_tool: tool },
        stopWhen: stepCountIs(5),
        onStepFinish: (step: any) => {
          stepResults.push(step);
        },
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call_1', name: 'simple_tool', arguments: {} }] },
          );
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Done.' });
        },
      });

      // At least one step finish for the tool call and one for the text completion
      expect(stepResults.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── Evented-specific: onFinish callback ─────────────────────────────

  describe('evented-specific: onFinish', () => {
    const getMock = useLoopScenarioAimock();

    it('onFinish fires when execution completes', async () => {
      let finishCalled = false;
      let finishResult: any = null;

      await runLoopScenario({
        llm: getMock(),
        prompt: 'Say hello.',
        maxSteps: 2,
        onFinish: (result: any) => {
          finishCalled = true;
          finishResult = result;
        },
        fixtures: llm => {
          llm.on({ endpoint: 'chat' }, { content: 'Hello from evented engine.' });
        },
      });

      expect(finishCalled).toBe(true);
      expect(finishResult).toBeDefined();
    });
  });
});
