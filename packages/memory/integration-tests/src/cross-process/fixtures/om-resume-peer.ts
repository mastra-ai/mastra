/**
 * Peer for om-resume-prompt.test.ts (#27614). One process of a durable agent with
 * Observational Memory on a shared LibSQL file, driven over IPC by the test.
 *
 * argv: <dbUrl> <engine: normal|durable|evented|fs> <mode: hang|normal> [aimockUrl]
 * When aimockUrl is provided, the actor uses AIMock over HTTP. In `hang` mode
 * the scripted actor blocks on the final call; the AIMock test holds its final
 * response long enough to SIGKILL the worker while the turn is in flight.
 */
import { createOpenAI } from '@ai-sdk/openai-v5';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent, createEventedAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { MastraLanguageModelV2Mock } from '@mastra/core/test-utils/llm-mock';
import { createTool } from '@mastra/core/tools';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';

export const USER_REQUEST = 'USER_REQUEST_MARKER: look up the order status for order 4471 and report it back.';
export const FINAL_ANSWER = 'Order 4471 has shipped.';

export interface ActorCall {
  hasUserRequest: boolean;
  lastTool?: string;
  toolResults: string[];
  final: boolean;
}

export interface StoredState {
  messages: { id: string; role: string; parts: string[] }[];
  observedMessageIds: string[];
}

export type PeerEvent =
  | { type: 'ready' }
  | { type: 'actor'; data: ActorCall }
  | { type: 'observer' }
  | { type: 'done'; data: { text: string } }
  | { type: 'runs'; data: { runId: string; status?: string }[] }
  | { type: 'lapsed' }
  | { type: 'recovered'; data: { succeeded: number; failed: number } }
  | { type: 'dump'; data: StoredState }
  | { type: 'merged' }
  | { type: 'error'; data: { message: string } };

export type PeerCommand =
  | { type: 'stream' }
  | { type: 'runs' }
  | { type: 'lapse'; runId: string }
  | { type: 'recover' }
  | { type: 'release' }
  | { type: 'dump' };

const isMain = process.argv[1]?.endsWith('om-resume-peer.ts');

if (isMain) {
  const [dbUrl, engine, mode, aimockUrl, scenario] = process.argv.slice(2);
  const backgroundMerge = scenario === 'background-merge';
  const send = (event: PeerEvent) => process.send!(event);
  let releaseResearch!: () => void;
  const researchGate = new Promise<void>(resolve => (releaseResearch = resolve));

  const filler = Array.from({ length: 400 }, (_, i) => `line ${i}: shipment scan event recorded at depot`).join('\n');
  const OBSERVATIONS =
    '<observations>\n## January 28, 2026\n- 🔴 User asked to look up an order status\n</observations>\n<current-task>Look up the order status</current-task>';
  type DoStream = Extract<
    NonNullable<ConstructorParameters<typeof MastraLanguageModelV2Mock>[0]>['doStream'],
    (...args: never[]) => unknown
  >;
  type StreamPart = Awaited<ReturnType<DoStream>>['stream'] extends ReadableStream<infer P> ? P : never;
  const usage = { inputTokens: 5, outputTokens: 5, totalTokens: 10 };
  const streamOf = (id: string, body: StreamPart[]) =>
    new ReadableStream<StreamPart>({
      start(c) {
        c.enqueue({ type: 'stream-start', warnings: [] });
        c.enqueue({ type: 'response-metadata', id, modelId: 'mock', timestamp: new Date(0) });
        for (const part of body) c.enqueue(part);
        c.close();
      },
    });
  const text = (t: string): StreamPart[] => [
    { type: 'text-start', id: 't' },
    { type: 'text-delta', id: 't', delta: t },
    { type: 'text-end', id: 't' },
    { type: 'finish', finishReason: 'stop', usage },
  ];
  const toolCall = (toolCallId: string, orderId: string): StreamPart[] => [
    { type: 'tool-call', toolCallId, toolName: 'lookup', input: JSON.stringify({ orderId }) },
    { type: 'finish', finishReason: 'tool-calls', usage },
  ];

  let actorCalls = 0;
  const actor = new MastraLanguageModelV2Mock({
    async doStream({ prompt }) {
      actorCalls++;
      const last = prompt.at(-1);
      const lastTool =
        last?.role === 'tool' ? (last.content.at(-1) as { toolCallId?: string } | undefined)?.toolCallId : undefined;
      const call: ActorCall = {
        hasUserRequest: JSON.stringify(prompt).includes('USER_REQUEST_MARKER'),
        lastTool,
        toolResults: prompt
          .filter(m => m.role === 'tool')
          .flatMap(m => m.content.map(c => (c as { toolCallId: string }).toolCallId)),
        final: lastTool === 'call_1',
      };
      // Scripted on the last message only, so a prompt that lost the request still reaches the final answer.
      const body =
        last?.role === 'user'
          ? toolCall('call_0', '4471-0')
          : lastTool === 'call_0'
            ? toolCall('call_1', '4471-1')
            : lastTool === 'call_1'
              ? text(FINAL_ANSWER)
              : text('LOST_CONTEXT');
      send({ type: 'actor', data: call });
      if (call.final && mode === 'hang') await new Promise(() => {});
      return { stream: streamOf(`a${actorCalls}`, body) };
    },
  });

  const observer = new MastraLanguageModelV2Mock({
    async doGenerate() {
      send({ type: 'observer' });
      return { content: [{ type: 'text', text: OBSERVATIONS }], finishReason: 'stop', usage, warnings: [] };
    },
    async doStream() {
      send({ type: 'observer' });
      return { stream: streamOf('o', text(OBSERVATIONS)) };
    },
  });

  const research = createTool({
    id: 'research',
    description: 'Research the delivery window',
    inputSchema: {
      type: 'object',
      properties: { topic: { type: 'string' } },
      additionalProperties: false,
    },
    background: { enabled: true, timeoutMs: 30_000 },
    execute: async () => {
      await researchGate;
      return { finding: 'BACKGROUND_RESULT_MARKER: delivery window confirmed' };
    },
  });
  const lookup = createTool({
    id: 'lookup',
    description: 'Look up an order',
    inputSchema: {
      type: 'object',
      properties: { orderId: { type: 'string' } },
      additionalProperties: false,
    },
    // A JSON Schema input carries no static type; the schema above validates the shape.
    execute: async input => `TOOL_RESULT ${(input as { orderId?: string }).orderId ?? ''}\n${filler}`,
  });

  const storage = new LibSQLStore({ id: 'om-resume', url: dbUrl! });
  const memory = new Memory({
    storage,
    options: {
      observationalMemory: {
        enabled: true,
        observation: { model: observer, messageTokens: 1000, bufferTokens: false },
        reflection: { model: observer, observationTokens: 100_000 },
      },
    },
  });
  const agent = new Agent({
    id: 'om-resume-agent',
    name: 'om-resume-agent',
    instructions: 'Use tools.',
    model: aimockUrl
      ? createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${aimockUrl}/v1` })('aimock-scenario')
      : actor,
    tools: backgroundMerge ? { lookup, research } : { lookup },
    ...(backgroundMerge ? { backgroundTasks: { tools: { research: true } } } : {}),
    memory,
  });
  // A plain durable agent persists `running` snapshots only when asked to (see run-recovery.md).
  const registrable =
    engine === 'evented'
      ? createEventedAgent({ agent })
      : engine === 'durable'
        ? createDurableAgent({ agent, shouldPersistSnapshot: () => true })
        : agent;
  const mastra = new Mastra({
    logger: false,
    storage,
    agents: engine === 'fs' ? {} : { [registrable.id]: registrable },
    ...(backgroundMerge ? { backgroundTasks: { enabled: true } } : {}),
  });
  if (engine === 'fs') mastra.__registerFsAgents({ [agent.id]: agent });
  const runningAgent = mastra.getAgent(agent.id);

  process.on('message', async (cmd: PeerCommand) => {
    try {
      const workflows = (await storage.getStore('workflows'))!;
      if (cmd.type === 'stream') {
        const result = await runningAgent.stream(USER_REQUEST, {
          memory: { thread: 't1', resource: 'r1' },
          maxSteps: 6,
        });
        const output = (result as { output?: typeof result }).output ?? result;
        if (mode !== 'hang') send({ type: 'done', data: { text: await output.text } });
      } else if (cmd.type === 'runs') {
        const { runs } = await workflows.listWorkflowRuns({});
        send({
          type: 'runs',
          data: runs.map(r => ({
            runId: r.runId,
            status: (typeof r.snapshot === 'string' ? JSON.parse(r.snapshot) : r.snapshot)?.status,
          })),
        });
      } else if (cmd.type === 'lapse') {
        // SIGKILL leaves the dead worker's claim behind; release it instead of waiting for the lease.
        const rec = await workflows.getRunOwnership({ runId: cmd.runId });
        if (rec?.live) {
          await workflows.releaseRunOwnership({ runId: cmd.runId, generation: rec.generation, ownerId: rec.ownerId });
        }
        send({ type: 'lapsed' });
      } else if (cmd.type === 'recover') {
        if (engine !== 'durable' && engine !== 'evented') throw new Error('Recovery requires a durable engine');
        const r = await (
          runningAgent as typeof registrable & {
            recoverActiveRuns: () => Promise<{ succeeded: number; failed: number }>;
          }
        ).recoverActiveRuns();
        send({ type: 'recovered', data: { succeeded: r.succeeded, failed: r.failed } });
      } else if (cmd.type === 'release') {
        releaseResearch();
      } else if (cmd.type === 'dump') {
        const mem = (await storage.getStore('memory'))!;
        const { messages } = await mem.listMessages({ threadId: 't1', perPage: false });
        const om = await mem.getObservationalMemory('t1', 'r1');
        send({
          type: 'dump',
          data: {
            messages: messages.map(m => ({
              id: m.id,
              role: m.role,
              parts: (m.content?.parts ?? [])
                .filter(p => p.type !== 'step-start' && !p.type.startsWith('data-om-'))
                .map(p =>
                  p.type === 'text'
                    ? `text:${p.text}`
                    : p.type === 'tool-invocation'
                      ? `tool:${p.toolInvocation.toolCallId}:${p.toolInvocation.state}${JSON.stringify(p.toolInvocation.result).includes('BACKGROUND_RESULT_MARKER') ? ':BACKGROUND_RESULT_MARKER' : ''}`
                      : p.type,
                ),
            })),
            observedMessageIds: om?.observedMessageIds ?? [],
          },
        });
      }
    } catch (err) {
      send({ type: 'error', data: { message: (err as Error)?.stack ?? String(err) } });
    }
  });

  // No top-level await: this workspace isn't "type": "module", so tsx runs the peer as CJS.
  void storage
    .init()
    .then(async () => {
      if (backgroundMerge) {
        const memoryStore = (await storage.getStore('memory'))!;
        const saveMessages = memoryStore.saveMessages.bind(memoryStore);
        memoryStore.saveMessages = async args => {
          const result = await saveMessages(args);
          if (JSON.stringify(args.messages).includes('BACKGROUND_RESULT_MARKER')) send({ type: 'merged' });
          return result;
        };
      }
    })
    .then(() => mastra.startWorkers?.().catch(() => {}))
    .then(() => send({ type: 'ready' }));
}
