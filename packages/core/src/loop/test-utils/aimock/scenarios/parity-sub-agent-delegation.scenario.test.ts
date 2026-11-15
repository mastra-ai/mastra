/**
 * Ported from validation harness case T12 (sub-agent-delegation), source 23f640a.
 * The worker's two side effects and answer must reach the supervisor exactly once.
 * Restart/atomic delegation checks belong to COR-1449, not this fault-free port.
 */
import { randomUUID } from 'node:crypto';
import { appendFileSync, mkdirSync } from 'node:fs';
import type { ReadableStream } from 'node:stream/web';
import { createOpenAI } from '@ai-sdk/openai-v5';
import type { ChatCompletionRequest } from '@copilotkit/aimock';
import { expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Agent, isAgentCompatible } from '../../../../agent';
import type { SubAgent } from '../../../../agent';
import { createDurableAgent, createEventedAgent } from '../../../../agent/durable';
import { EventEmitterPubSub } from '../../../../events';
import { MockMemory } from '../../../../memory/mock';
import type { ChunkType } from '../../../../stream/types';
import { createTool } from '../../../../tools';
import { createSharedAgent, describeForAllEngines, useLoopScenarioAimock } from '../aimock-scenario';
import type { EngineObservation, ParityEngine } from '../parity';
import {
  chunksOfType,
  createRecordingModel,
  describeParity,
  expectParity,
  textOnlyTape,
  toolCallTape,
} from '../parity';
import { SCENARIO_MODEL_ID } from '../types';

describeParity('sub-agent-delegation parity', target => {
  it('worker commits both steps and delivers its answer to the supervisor', async () => {
    const states = new Map<ParityEngine, { memory: MockMemory; commits: number[] }>();
    let targetThreadId: string;
    const results = await expectParity(target, {
      differences: {
        [target]: {
          reason:
            'COR-1390: each delegation generates a fresh subAgentThreadId; compare all other result fields exactly.',
          expect: (plain: EngineObservation) => {
            const expected = structuredClone(plain);
            const replaceId = (result: unknown) => ({
              ...z.looseObject({ subAgentThreadId: z.string() }).parse(result),
              subAgentThreadId: targetThreadId,
            });
            const replaceMessageIds = (payload: unknown) => {
              const { messages } = payload as {
                messages: Record<
                  'all' | 'nonUser',
                  Array<{ content: Array<{ type: string; toolName: string; output: { value: unknown } }> }>
                >;
              };
              for (const list of [messages.all, messages.nonUser]) {
                for (const message of list) {
                  for (const part of message.content) {
                    if (part.type === 'tool-result' && part.toolName === 'agent-worker') {
                      part.output.value = replaceId(part.output.value);
                    }
                  }
                }
              }
            };
            for (const turn of expected.turns) {
              turn.chunkTypes.forEach((type, index) => {
                if (type === 'tool-result') {
                  const payload = turn.chunkPayloads[index] as { toolName: string; result: unknown };
                  if (payload.toolName === 'agent-worker') payload.result = replaceId(payload.result);
                }
                if (type === 'finish') replaceMessageIds(turn.chunkPayloads[index]);
              });
              replaceMessageIds(turn.finishChunk.payload);
              for (const result of turn.toolResults) {
                if (result.toolName === 'agent-worker') result.result = replaceId(result.result);
              }
            }
            return expected;
          },
        },
      },
      run: async handle => {
        const turn = await handle.turn('Get the steps done.', {
          maxSteps: 4,
          memory: { thread: 't12-thread', resource: 't12-resource' },
        });
        const delegation = turn.toolResults.find(result => result.toolName === 'agent-worker')!;
        const result = z.looseObject({ subAgentThreadId: z.string() }).parse(delegation.result);
        expect(result.subAgentThreadId).toMatch(/^t12-thread-[0-9a-f-]{36}$/);
        if (handle.engine === target) targetThreadId = result.subAgentThreadId;
      },
      model: {
        respond: request => {
          const results = request.prompt.flatMap(message => (message.role === 'tool' ? message.content : []));
          return results.length
            ? textOnlyTape(`delegated ${JSON.stringify(results.at(-1))}`)
            : toolCallTape('agent-worker', { prompt: 'Do both steps.' }, 't12-delegation');
        },
      },
      buildAgent: ({ engine, model }) => {
        const state = { memory: new MockMemory(), commits: [] as number[] };
        states.set(engine, state);
        const worker = new Agent({
          id: 't12-worker',
          name: 'worker',
          description: 'Performs the numbered steps.',
          instructions: 'Follow the script.',
          model: createRecordingModel({
            tapes: [
              toolCallTape('step', { n: 1 }, 't12-step-1'),
              toolCallTape('step', { n: 2 }, 't12-step-2'),
              textOnlyTape('finished 2 steps'),
            ],
          }).model,
          tools: {
            step: createTool({
              id: 'step',
              description: 'Commit one numbered step.',
              inputSchema: z.object({ n: z.number() }),
              execute: async ({ n }) => {
                state.commits.push(n);
                return { n };
              },
            }),
          },
        });
        return new Agent({
          id: 't12-supervisor',
          name: 'supervisor',
          instructions: 'Follow the script.',
          model,
          memory: state.memory,
          agents: { worker },
        });
      },
      input: 'Get the steps done.',
      options: { maxSteps: 4, memory: { thread: 't12-thread', resource: 't12-resource' } },
    });
    for (const engine of ['plain', target] as const) {
      const state = states.get(engine)!;
      const turn = results[engine]!.turns[0]!;
      expect(state.commits).toEqual([1, 2]);
      expect(turn.error).toBeUndefined();
      expect(chunksOfType(turn, 'finish')).toBe(1);
      expect(chunksOfType(turn, 'error')).toBe(0);
      expect(turn.text.startsWith('delegated')).toBe(true);
      const delegation = turn.toolResults.filter(result => result.toolName === 'agent-worker');
      expect(delegation).toHaveLength(1);
      expect(JSON.stringify(delegation[0]!.result)).toContain('finished 2 steps');
      const publicResult = turn.chunkPayloads[turn.chunkTypes.indexOf('tool-result')];
      expect(publicResult).toMatchObject({
        toolName: 'agent-worker',
        providerMetadata: { mastra: { modelOutput: { type: 'text', value: 'finished 2 steps' } } },
      });
      const { messages } = await state.memory.recall({ threadId: 't12-thread', resourceId: 't12-resource' });
      const parts = messages
        .flatMap(message => message.content.parts ?? [])
        .filter(part => part.type === 'tool-invocation' && part.toolInvocation.toolName === 'agent-worker');
      expect(parts).toHaveLength(1);
      expect(parts[0]!.type === 'tool-invocation' && parts[0]!.toolInvocation.state).toBe('result');
    }
  });
});

type QualificationEngine = 'plain' | 'durable' | 'evented';
type QualificationCell = {
  scenario: 'success' | 'approval' | 'decline' | 'siblings';
  parent: QualificationEngine;
  children: QualificationEngine[];
};
const qualificationEngines = ['plain', 'durable', 'evented'] as const;
const approvalPairs = qualificationEngines.flatMap(child => [
  { parent: 'plain' as const, children: [child] },
  ...(child === 'plain' ? [] : [{ parent: child, children: [child] }]),
]);
const qualificationCells: QualificationCell[] = [
  ...qualificationEngines.flatMap(parent =>
    qualificationEngines.map(child => ({
      scenario: 'success' as const,
      parent,
      children: [child],
    })),
  ),
  ...(['approval', 'decline'] as const).flatMap(scenario => approvalPairs.map(pair => ({ scenario, ...pair }))),
  ...qualificationEngines.map((parent, index) => ({
    scenario: 'siblings' as const,
    parent,
    children: [parent, qualificationEngines[(index + 1) % 3]!],
  })),
];

// Public onChunk callbacks tap the child's execution without consuming its reader.
// These are source callbacks, not a claim of a universal child observe API.
describeForAllEngines('delegation qualification', engine => {
  if (engine !== 'normal' && engine !== 'durable' && engine !== 'evented') {
    it('declares 22 unique execution-engine cells (file routing is not a fourth engine)', () => {
      expect(qualificationCells).toHaveLength(22);
      expect(
        new Set(qualificationCells.map(cell => `${cell.scenario}/${cell.parent}/${cell.children.join('+')}`)).size,
      ).toBe(22);
    });
    return;
  }
  const parent = engine === 'normal' ? 'plain' : engine;
  const getMock = useLoopScenarioAimock();
  for (const cell of qualificationCells.filter(cell => cell.parent === parent)) {
    const name = `${cell.scenario}/${cell.parent}/${cell.children.join('+')}`;
    it(
      name,
      async () => {
        const mock = getMock();
        const id = `${name.replaceAll('/', '-')}-${randomUUID()}`;
        const proof = process.env.STREAM_QUAL_DELEGATION_EVIDENCE_DIR;
        const record = (type: string, data: unknown) => {
          if (!proof) return;
          mkdirSync(proof, { recursive: true });
          appendFileSync(
            `${proof}/${name.replaceAll('/', '-')}.jsonl`,
            JSON.stringify({
              type,
              at: new Date().toISOString(),
              pid: process.pid,
              cell,
              data,
            }) + '\n',
          );
        };
        record('started', { id, manifest: qualificationCells });
        const effects: string[] = [];
        const source: ChunkType[][] = cell.children.map(() => []);
        const projected: ChunkType[] = [];
        const bus = new EventEmitterPubSub();
        const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${mock.url}/v1` });
        const memory = new MockMemory();
        const agents: Record<string, SubAgent> = {};
        for (const [index, childEngine] of cell.children.entries()) {
          const key = `worker${index}`;
          const child = new Agent({
            id: `${key}-${id}`,
            name: key,
            description: `Qualification child ${index}`,
            instructions: 'Follow the script.',
            model: openai(SCENARIO_MODEL_ID),
            defaultOptions: {
              onChunk: chunk => {
                source[index]!.push(chunk);
                record('child-frame', { index, chunk });
              },
            },
            tools: {
              [`effect${index}`]: createTool({
                id: `effect${index}`,
                description: 'Record a protected side effect.',
                inputSchema: z.object({ value: z.literal(key) }),
                requireApproval: cell.scenario !== 'success',
                execute: async ({ value }) => {
                  effects.push(value);
                  record('effect', { index, value });
                  return { value };
                },
              }),
            },
          });
          const wrappedChild =
            childEngine === 'durable'
              ? createDurableAgent({ agent: child, cleanupTimeoutMs: 0 })
              : childEngine === 'evented'
                ? createEventedAgent({ agent: child, pubsub: bus })
                : child;
          if (!isAgentCompatible(wrappedChild)) throw new Error(`Unsupported child engine: ${childEngine}`);
          agents[key] = wrappedChild;
        }
        const hasTool = (request: ChatCompletionRequest, name: string) =>
          request.tools?.some(tool => tool.function.name === name) ?? false;
        const hasResult = (request: ChatCompletionRequest) => request.messages.some(message => message.role === 'tool');
        mock.on(
          { endpoint: 'chat', predicate: req => hasTool(req, 'agent-worker0') && !hasResult(req) },
          {
            toolCalls: cell.children.map((_, index) => ({
              id: `outer-${index}`,
              name: `agent-worker${index}`,
              arguments: { prompt: `Run worker${index}.` },
            })),
          },
        );
        mock.on(
          { endpoint: 'chat', predicate: req => hasTool(req, 'agent-worker0') && hasResult(req) },
          { content: 'Supervisor complete.' },
        );
        for (const index of cell.children.keys()) {
          mock.on(
            { endpoint: 'chat', predicate: req => hasTool(req, `effect${index}`) && !hasResult(req) },
            {
              toolCalls: [{ id: `inner-${index}`, name: `effect${index}`, arguments: { value: `worker${index}` } }],
            },
          );
          mock.on(
            { endpoint: 'chat', predicate: req => hasTool(req, `effect${index}`) && hasResult(req) },
            { content: `Worker${index} complete.` },
          );
        }
        const shared = await createSharedAgent(mock, {
          engine,
          memory,
          agents,
          pubsub: bus,
          instructions: 'Delegate to the workers, then finish.',
        });
        for (const child of Object.values(agents)) shared.mastra.addAgent(child);
        const options = {
          runId: `run-${id}`,
          memory: { thread: `thread-${id}`, resource: `resource-${id}` },
          maxSteps: 5,
          closeOnSuspend: true,
        };
        const drain = async (stream: ReadableStream<ChunkType>, approvalCount = 0) => {
          const reader = stream.getReader();
          const deadline = Date.now() + 20_000;
          try {
            for (;;) {
              let timer: ReturnType<typeof setTimeout> | undefined;
              const next = await Promise.race([
                reader.read(),
                new Promise<never>((_, reject) => {
                  timer = setTimeout(
                    () => reject(new Error('Delegation reader deadline')),
                    Math.max(0, deadline - Date.now()),
                  );
                }),
              ]).finally(() => clearTimeout(timer));
              if (next.done) break;
              projected.push(next.value);
              record('parent-frame', next.value);
              if (
                approvalCount &&
                projected.filter(chunk => chunk.type === 'tool-call-approval').length >= approvalCount
              )
                break;
            }
          } finally {
            reader.releaseLock();
          }
        };
        try {
          // Parallel children suspend independently; keep this reader open until both approvals arrive.
          await drain(
            (
              await shared.agent.stream('Run the workers.', {
                ...options,
                closeOnSuspend: cell.scenario !== 'siblings',
              })
            ).fullStream,
            cell.scenario === 'siblings' ? cell.children.length : 0,
          );
          if (cell.scenario !== 'success') {
            expect(effects).toEqual([]);
            const approvals = projected.filter(chunk => chunk.type === 'tool-call-approval');
            expect(approvals).toHaveLength(cell.children.length);
            const entries = await vi.waitFor(
              async () => {
                const { messages } = await memory.recall({
                  threadId: options.memory.thread,
                  resourceId: options.memory.resource,
                });
                const entrySchema = z.object({
                  runId: z.string(),
                  toolCallId: z.string(),
                  delegatedRunId: z.string(),
                  delegatedToolCallId: z.string(),
                  delegatedToolName: z.string(),
                });
                const entries = messages.flatMap(message => {
                  const pending = message.content.metadata?.pendingToolApprovals;
                  return pending ? Object.values(pending).map(entry => entrySchema.parse(entry)) : [];
                });
                expect(new Set(entries.map(entry => entry.toolCallId)).size).toBe(cell.children.length);
                return [...new Map(entries.map(entry => [entry.toolCallId, entry])).values()];
              },
              { timeout: 5000 },
            );
            record('approval-identities', entries);
            expect(new Set(entries.map(entry => entry.delegatedRunId)).size).toBe(cell.children.length);
            for (const [index] of cell.children.entries()) {
              const entry = entries.find(entry => entry.toolCallId === `outer-${index}`)!;
              expect(entry).toMatchObject({
                delegatedToolCallId: `inner-${index}`,
                delegatedToolName: `effect${index}`,
              });
              expect(entry.delegatedRunId).not.toBe(entry.runId);
              const decision = cell.scenario !== 'decline' && index === 0;
              const resumed = decision
                ? await shared.agent.approveToolCall({ ...options, runId: entry.runId, toolCallId: entry.toolCallId })
                : await shared.agent.declineToolCall({
                    ...options,
                    runId: entry.runId,
                    toolCallId: entry.toolCallId,
                    reason: 'Qualification denied.',
                  });
              await drain(resumed.fullStream);
            }
          }
          expect(effects).toEqual(cell.scenario === 'decline' ? [] : ['worker0']);
          expect(projected.filter(chunk => chunk.type === 'finish')).toHaveLength(1);
          expect(projected.filter(chunk => ['error', 'abort', 'tool-error'].includes(chunk.type))).toEqual([]);
          expect(
            projected
              .filter(chunk => chunk.type === 'text-delta')
              .map(chunk => chunk.payload.text)
              .join(''),
          ).toBe('Supervisor complete.');
          for (const [index] of cell.children.entries()) {
            expect(source[index]!.length, `source callbacks for worker${index}`).toBeGreaterThan(0);
            expect(
              source[index]!.filter(chunk => chunk.type === 'text-delta')
                .map(chunk => chunk.payload.text)
                .join(''),
            ).toBe(`Worker${index} complete.`);
            expect(
              mock.getRequests().filter(request => hasTool(request.body as ChatCompletionRequest, `effect${index}`)),
            ).toHaveLength(2);
            const output = projected
              .filter(chunk => chunk.type === 'tool-output')
              .filter(chunk => chunk.payload.toolCallId === `outer-${index}`);
            expect(output.length, `projected worker${index} frames`).toBeGreaterThan(0);
            expect(
              output.every(chunk => chunk.runId === options.runId && chunk.payload.toolName === `agent-worker${index}`),
            ).toBe(true);
            const nested = output.map(chunk =>
              z
                .object({
                  type: z.string(),
                  runId: z.string(),
                  payload: z.looseObject({ text: z.string().optional() }),
                })
                .parse(chunk.payload.output),
            );
            const childRunIds = [...new Set(source[index]!.map(chunk => chunk.runId))];
            expect(childRunIds).toHaveLength(1);
            expect(childRunIds[0]).not.toBe(options.runId);
            expect([...new Set(nested.map(chunk => chunk.runId))]).toEqual(childRunIds);
            expect(nested.filter(chunk => chunk.type === 'finish')).toHaveLength(1);
            expect(
              nested
                .filter(chunk => chunk.type === 'text-delta')
                .map(chunk => chunk.payload.text)
                .join(''),
            ).toBe(`Worker${index} complete.`);
            const results = projected
              .filter(chunk => chunk.type === 'tool-result')
              .filter(chunk => chunk.payload.toolCallId === `outer-${index}`);
            expect(results).toHaveLength(1);
            const result = z
              .object({ subAgentThreadId: z.string(), subAgentResourceId: z.string() })
              .parse(results[0]!.payload.result);
            expect(result.subAgentThreadId).not.toBe(options.memory.thread);
            record('identity', {
              parentRunId: options.runId,
              outerToolCallId: `outer-${index}`,
              childRunId: childRunIds[0],
              ...result,
            });
            for (const sibling of cell.children.keys()) {
              if (sibling !== index) expect(source[sibling]!.some(chunk => chunk.runId === childRunIds[0])).toBe(false);
            }
          }
          expect(
            mock.getRequests().filter(request => hasTool(request.body as ChatCompletionRequest, 'agent-worker0')),
          ).toHaveLength(2);
          record('qualified', { effects, requests: mock.getRequests() });
        } catch (error) {
          record('failure', { error: String(error), effects, requests: mock.getRequests() });
          throw error;
        } finally {
          try {
            await shared.mastra.stopWorkers();
          } finally {
            await bus.close();
          }
          record('cleanup', { stopped: true, pubsubClosed: true });
        }
      },
      60000,
    );
  }
});
