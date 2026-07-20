import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import { afterAll, afterEach, beforeAll, describe } from 'vitest';
import { Agent } from '../../../agent';
import { createDurableAgent } from '../../../agent/durable';
import { assembleAgentFromFsEntry } from '../../../agent/fs-routing';
import { isDurableAgentLike } from '../../../agent/types';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage';
import type { MastraModelOutput } from '../../../stream/base/output';
import type { ChunkType } from '../../../stream/types';
import type { EngineVariant, LoopScenarioResult, RunApprovalScenarioOptions, RunLoopScenarioOptions } from './types';
import { ALL_ENGINE_VARIANTS, SCENARIO_MODEL_ID } from './types';

/**
 * Start a shared AIMock server for the lifetime of a test suite and wire its
 * vitest lifecycle hooks.
 *
 * One HTTP server is reused across the whole suite (an AIMock server per test
 * is slow). Between tests we reset fixtures and the captured request journal so
 * each scenario starts from a clean slate.
 *
 * Returns a getter — call it inside a test to access the live {@link LLMock}.
 */
export function useLoopScenarioAimock(): () => LLMock {
  let mock: LLMock | undefined;

  beforeAll(async () => {
    // port: 0 -> ephemeral port, avoids cross-suite port collisions.
    mock = new LLMock({ port: 0 });
    await mock.start();
  });

  afterEach(() => {
    // Drop scenario-specific fixtures and captured requests, but keep the
    // server (and its port) alive for the next test in the suite.
    mock?.clearFixtures();
    mock?.clearRequests();
    mock?.resetMatchCounts();
  });

  afterAll(async () => {
    await mock?.stop();
    mock = undefined;
  });

  return () => {
    if (!mock) {
      throw new Error('AIMock server is not running. Did you call useLoopScenarioAimock() at suite scope?');
    }
    return mock;
  };
}

let scenarioAgentCounter = 0;

/**
 * Create a shared agent/mastra pair that persists across multiple
 * `runLoopScenario` calls. Use for suspend/resume scenarios where the same
 * agent+storage must survive across calls.
 *
 * Pass the result to `runLoopScenario` via the `sharedAgent` option:
 * ```ts
 * const shared = await createSharedAgent(getMock(), { tools: { myTool } });
 * await runLoopScenario({ llm: getMock(), ..., sharedAgent: shared });
 * await runLoopScenario({ llm: getMock(), ..., sharedAgent: shared });
 * ```
 */
export async function createSharedAgent(
  llm: LLMock,
  opts: Pick<
    RunLoopScenarioOptions,
    | 'tools'
    | 'signals'
    | 'instructions'
    | 'memory'
    | 'workspace'
    | 'agents'
    | 'workflows'
    | 'agentBackgroundTasks'
    | 'goal'
    | 'backgroundTasks'
    | 'model'
    | 'errorProcessors'
    | 'defaultOptions'
    | 'pubsub'
    | 'engine'
  > = {},
): Promise<{ agent: Agent; mastra: any }> {
  return buildScenarioAgent({ llm, ...opts });
}

/**
 * Build an {@link Agent} backed by a real OpenAI v5 provider pointed at the
 * in-test AIMock server, registered on a {@link Mastra} instance with storage
 * so suspend/resume (tool approval) works.
 *
 * When `engine === 'durable'`, wraps the agent with `createDurableAgent` and
 * moves stream-level inputProcessors onto the agent constructor.
 */
async function buildScenarioAgent({
  llm,
  tools,
  signals,
  instructions,
  memory,
  workspace,
  agents,
  workflows,
  agentBackgroundTasks,
  goal,
  backgroundTasks,
  model,
  errorProcessors,
  defaultOptions,
  pubsub,
  engine,
  inputProcessors,
  fsRouted,
}: Pick<
  RunLoopScenarioOptions,
  | 'llm'
  | 'tools'
  | 'signals'
  | 'instructions'
  | 'memory'
  | 'workspace'
  | 'agents'
  | 'workflows'
  | 'agentBackgroundTasks'
  | 'goal'
  | 'backgroundTasks'
  | 'model'
  | 'errorProcessors'
  | 'defaultOptions'
  | 'pubsub'
  | 'engine'
  | 'inputProcessors'
  | 'fsRouted'
>): Promise<{ agent: any; mastra: any }> {
  const openai = createOpenAI({
    apiKey: 'aimock-test-key',
    baseURL: `${llm.url.replace(/\/+$/, '')}/v1`,
  });

  // Unique id per run so repeated scenarios in one suite don't collide on the
  // Mastra agent registry.
  const agentId = `aimock-loop-scenario-agent-${++scenarioAgentCounter}`;

  // Use dynamic model function if provided, otherwise use default AIMock-backed model
  const modelConfig = model ?? openai(SCENARIO_MODEL_ID);

  const defaultInstructions = 'You are a test agent driven by scripted AIMock responses.';

  // The `'fs'` variant assembles the agent via file-system routing; the explicit
  // `fsRouted` flag is kept as an alias so a single scenario can opt in without
  // running across the whole engine matrix.
  const isFs = engine === 'fs' || fsRouted === true;

  let agent: any;
  if (isFs) {
    // Build the agent exactly as the bundler would for an `agents/<name>/`
    // directory: a partial `config.ts` plus `instructions.md` and `tools/*`.
    // This proves a file-routed agent runs identically through the real loop.
    if (typeof instructions === 'function') {
      throw new Error("the 'fs' agent variant requires a static `instructions` string (the instructions.md body).");
    }
    const fsTools = tools
      ? Object.entries(tools as Record<string, any>).map(([key, tool]) => ({ key, tool }))
      : undefined;
    agent = assembleAgentFromFsEntry({
      name: agentId,
      config: {
        model: modelConfig,
        ...(signals ? { signals } : {}),
        ...(memory ? { memory } : {}),
        ...(workspace ? { workspace } : {}),
        ...(agents ? { agents } : {}),
        ...(workflows ? { workflows } : {}),
        ...(agentBackgroundTasks ? { backgroundTasks: agentBackgroundTasks } : {}),
        ...(goal ? { goal } : {}),
        ...(errorProcessors ? { errorProcessors } : {}),
        ...(defaultOptions ? { defaultOptions } : {}),
      },
      instructionsMd: (instructions as string | undefined) ?? defaultInstructions,
      ...(fsTools ? { tools: fsTools } : {}),
    });
  } else {
    agent = new Agent({
      id: agentId,
      name: 'AIMock Loop Scenario Agent',
      instructions: instructions ?? defaultInstructions,
      model: modelConfig,
      ...(tools ? { tools } : {}),
      ...(signals ? { signals } : {}),
      ...(memory ? { memory } : {}),
      ...(workspace ? { workspace } : {}),
      ...(agents ? { agents } : {}),
      ...(workflows ? { workflows } : {}),
      ...(agentBackgroundTasks ? { backgroundTasks: agentBackgroundTasks } : {}),
      ...(goal ? { goal } : {}),
      ...(errorProcessors ? { errorProcessors } : {}),
      ...(defaultOptions ? { defaultOptions } : {}),
      // For durable engine, inputProcessors must be on the agent constructor
      // (not yet supported as call-time options for durable); outputProcessors
      // are forwarded at call-time via preparation.ts.
      ...(engine === 'durable' && inputProcessors ? { inputProcessors } : {}),
    });
  }

  // Wrap with DurableAgent for the durable engine variant
  const registrableAgent = engine === 'durable' ? createDurableAgent({ agent }) : agent;

  // Registering the agent on a Mastra instance with storage is required for the
  // suspended snapshot rows that approveToolCall/declineToolCall resume from.
  // For the fs variant, register through the real file-routing path
  // (`__registerFsAgents`) instead of the constructor map, so the scenario
  // exercises exactly how the bundler injects file-based agents.
  const mastra = new Mastra({
    agents: isFs ? {} : { [agentId]: registrableAgent as any },
    logger: false,
    storage: new InMemoryStore(),
    ...(backgroundTasks ? { backgroundTasks } : {}),
    ...(pubsub ? { pubsub } : {}),
  });

  if (isFs) {
    mastra.__registerFsAgents({ [agentId]: registrableAgent as any });
  }

  // Start workers if background tasks are enabled
  if (backgroundTasks?.enabled) {
    await mastra.startWorkers();
  }

  return { agent: mastra.getAgent(agentId), mastra };
}

/**
 * Run a single scripted loop scenario against the AIMock server.
 *
 * Builds a real OpenAI v5 provider pointed at the in-test AIMock HTTP server
 * (via `baseURL`), constructs an {@link Agent} with the scenario's tools, runs
 * the prompt through the agentic loop, fully consumes the stream, and returns
 * both the emitted loop output and the per-turn requests AIMock captured.
 *
 * This mirrors how mastracode's e2e controller routes the real provider at AIMock
 * through `OPENAI_BASE_URL`, but stays in `packages/core` and asserts on loop
 * output instead of TUI screen text.
 */
export async function runLoopScenario(opts: RunLoopScenarioOptions): Promise<LoopScenarioResult> {
  const {
    llm,
    fixtures,
    prompt,
    tools,
    signals,
    instructions,
    stopWhen,
    maxSteps,
    isTaskComplete,
    structuredOutput,
    activeTools,
    outputProcessors,
    inputProcessors,
    prepareStep,
    memory,
    threadId,
    resourceId,
    memoryOptions,
    workspace,
    agents,
    workflows,
    requestContext,
    collectChunks,
    manualStreamConsumption,
    backgroundTasks,
    streamUntilIdle,
    agentBackgroundTasks,
    goal,
    objective,
    onIterationComplete,
    clientTools,
    toolChoice,
    model,
    delegation,
    abortSignal,
    providerOptions,
    modelSettings,
    toolsets,
    errorProcessors,
    onError,
    onChunk,
    onStepFinish,
    onFinish,
    savePerStep,
    actor,
    defaultOptions,
    sharedAgent,
    pubsub,
    engine = 'normal',
    fsRouted,
  } = opts;

  fixtures(llm);

  // Use shared agent/mastra if provided (for suspend/resume flows across calls),
  // otherwise build a fresh one.
  let agent: any;
  let mastra: any;
  if (sharedAgent) {
    // A standalone durable `Agent` satisfies `isDurableAgentLike` via a
    // self-referential `.agent` getter, so discriminate against a real
    // wrapper by checking `agent.agent !== agent`. See `Mastra.addAgent`.
    const sharedIsRealDurableWrapper =
      isDurableAgentLike(sharedAgent.agent) && (sharedAgent.agent as any).agent !== sharedAgent.agent;
    if (engine === 'durable' && !sharedIsRealDurableWrapper) {
      // sharedAgent provides a regular Agent on the first call; wrap it for
      // the durable engine and re-register on the Mastra instance so
      // .getAgent() returns the DurableAgent wrapper.  On subsequent calls
      // (e.g. resume), the agent is already wrapped — skip re-wrapping to
      // preserve the run registry across calls.
      const durableWrapper = createDurableAgent({ agent: sharedAgent.agent as any });
      const agentId = sharedAgent.agent.name;
      sharedAgent.mastra.removeAgent(agentId);
      sharedAgent.mastra.addAgent(durableWrapper as any, agentId);
      agent = sharedAgent.mastra.getAgent(agentId);
      // Mutate sharedAgent so subsequent calls see the wrapped version
      sharedAgent.agent = agent;
      mastra = sharedAgent.mastra;
    } else {
      agent = sharedAgent.agent;
      mastra = sharedAgent.mastra;
    }
  } else {
    const built = await buildScenarioAgent({
      llm,
      tools,
      signals,
      instructions,
      memory,
      workspace,
      agents,
      workflows,
      agentBackgroundTasks,
      goal,
      backgroundTasks,
      model,
      errorProcessors,
      defaultOptions,
      pubsub,
      engine,
      inputProcessors,
      fsRouted,
    });
    agent = built.agent;
    mastra = built.mastra;
  }

  // Set objective before streaming if provided (for goal scenarios)
  if (objective && threadId && resourceId) {
    await agent.setObjective(objective, { threadId, resourceId });
  }

  const memoryOption =
    memory && threadId
      ? {
          memory: {
            thread: threadId,
            ...(resourceId ? { resource: resourceId } : {}),
            ...(memoryOptions ? { options: memoryOptions } : {}),
          },
        }
      : {};

  // For durable engine, only pass options that DurableAgentStreamOptions supports.
  // inputProcessors are on the agent constructor, not call-time options.
  const isDurable = engine === 'durable';

  const streamOptions = {
    ...(stopWhen ? { stopWhen } : {}),
    ...(maxSteps ? { maxSteps } : {}),
    // Durable needs maxSteps as a fallback when stopWhen was the only bound
    ...(!maxSteps && stopWhen && isDurable ? { maxSteps: 10 } : {}),
    ...(isTaskComplete ? { isTaskComplete } : {}),
    ...(structuredOutput ? { structuredOutput } : {}),
    ...(activeTools ? { activeTools } : {}),
    ...(outputProcessors ? { outputProcessors } : {}),
    ...(inputProcessors && !isDurable ? { inputProcessors } : {}),
    ...(prepareStep ? { prepareStep } : {}),
    ...(requestContext ? { requestContext } : {}),
    ...(delegation ? { delegation } : {}),
    ...(onIterationComplete ? { onIterationComplete } : {}),
    ...(onStepFinish ? { onStepFinish } : {}),
    ...(onFinish ? { onFinish } : {}),
    ...(onError ? { onError } : {}),
    ...(onChunk && !isDurable ? { onChunk } : {}),
    ...(savePerStep !== undefined ? { savePerStep } : {}),
    ...(actor ? { actor } : {}),
    ...(abortSignal ? { abortSignal } : {}),
    ...(providerOptions ? { providerOptions } : {}),
    ...(modelSettings ? { modelSettings } : {}),
    ...(toolsets ? { toolsets } : {}),
    ...(clientTools ? { clientTools } : {}),
    ...(toolChoice ? { toolChoice } : {}),
    ...memoryOption,
  };

  let rawResult: any;
  if (isDurable) {
    rawResult = streamUntilIdle
      ? await agent.streamUntilIdle(prompt, streamOptions)
      : await agent.stream(prompt, streamOptions);
  } else {
    rawResult = streamUntilIdle
      ? await agent.streamUntilIdle(prompt, streamOptions)
      : await agent.stream(prompt, streamOptions);
  }

  // DurableAgent.stream() returns { output, fullStream, ... }; regular returns MastraModelOutput directly
  const output: MastraModelOutput<unknown> = isDurable
    ? (rawResult.output as unknown as MastraModelOutput<unknown>)
    : (rawResult as unknown as MastraModelOutput<unknown>);

  // For durable, fullStream is on the result object, not on output
  const fullStream = isDurable ? rawResult.fullStream : output.fullStream;

  // Drain the stream so every loop turn (and every AIMock request) completes
  // before we hand back the captured journal.
  let chunks: ChunkType[] | undefined;
  let suspendedDuringDrain = false;
  if (manualStreamConsumption) {
    // Skip consumption — test will manually drain the stream after publishing events.
  } else if (collectChunks) {
    chunks = [];
    try {
      for await (const chunk of fullStream as AsyncIterable<ChunkType>) {
        chunks.push(chunk);
        // Durable streams stay open after suspension (no FINISH event fires).
        // Break out so the harness returns and the test can call resume.
        if (isDurable && (chunk.type === 'tool-call-suspended' || chunk.type === 'tool-call-approval')) {
          suspendedDuringDrain = true;
          break;
        }
      }
    } catch {
      // Stream may error (e.g. provider errors) — we still want the chunks collected so far
    }
  } else if (isDurable) {
    // Durable: drain via fullStream iteration
    try {
      for await (const chunk of fullStream as AsyncIterable<ChunkType>) {
        // Durable streams stay open after suspension — break so the harness returns.
        if (chunk.type === 'tool-call-suspended' || chunk.type === 'tool-call-approval') {
          suspendedDuringDrain = true;
          break;
        }
      }
    } catch {
      // Stream may error on provider failures — swallow so runLoopScenario still returns
    }
  } else {
    await output.consumeStream();
  }

  // Clean up durable resources — but NOT when the stream was suspended or
  // the test wants to consume the stream manually (e.g. streamUntilIdle tests
  // that publish bg-task events after runLoopScenario returns).
  if (isDurable && rawResult.cleanup && !suspendedDuringDrain && !manualStreamConsumption) {
    try {
      rawResult.cleanup();
    } catch {
      // cleanup may race
    }
  }

  return {
    output,
    requests: llm.getRequests(),
    llm,
    ...(chunks ? { chunks } : {}),
    agent,
    mastra,
  };
}

/**
 * Options for skipping specific engine variants within `describeForAllEngines`.
 */
export interface EngineSkipOptions {
  /** Engine variants to skip for this test file. */
  skip?: EngineVariant[];
}

/**
 * Parameterised describe that runs a test factory once per engine variant.
 *
 * Usage:
 * ```ts
 * describeForAllEngines('my scenario', (engine) => {
 *   const getMock = useLoopScenarioAimock();
 *   it('does something', async () => {
 *     await runLoopScenario({ llm: getMock(), engine, ... });
 *   });
 * });
 * ```
 *
 * Tests that use features unsupported by durable (stopWhen, delegation, etc.)
 * can pass `{ skip: ['durable'] }` to exclude specific variants.
 */
export function describeForAllEngines(
  name: string,
  factory: (engine: EngineVariant) => void,
  options?: EngineSkipOptions,
): void {
  const variants = ALL_ENGINE_VARIANTS.filter(v => !options?.skip?.includes(v));
  for (const engine of variants) {
    describe(`${name} [${engine}]`, () => {
      factory(engine);
    });
  }
}

/**
 * Run a scripted loop scenario that suspends for tool approval, then resolves
 * each approval request (approve or decline) and drives the loop to completion.
 *
 * The loop is started with `requireToolApproval: true`. Every `tool-call-approval`
 * chunk is collected, resolved via `agent.approveToolCall` / `agent.declineToolCall`
 * per the `decision` callback, and resumed until the run no longer suspends.
 *
 * Returns the final resumed output, the full ordered list of chunks observed
 * across the initial run and every resume, and the captured AIMock requests.
 */
export async function runApprovalScenario({
  llm,
  fixtures,
  prompt,
  tools,
  instructions,
  stopWhen,
  decision,
  requireToolApproval = true,
}: RunApprovalScenarioOptions): Promise<LoopScenarioResult & { chunks: ChunkType[]; approvals: string[] }> {
  fixtures(llm);

  const { agent } = await buildScenarioAgent({ llm, tools, instructions });

  const chunks: ChunkType[] = [];
  const approvals: string[] = [];

  let output = (await agent.stream(prompt, {
    ...(requireToolApproval !== false ? { requireToolApproval } : {}),
    ...(stopWhen ? { stopWhen } : {}),
  })) as unknown as MastraModelOutput<unknown>;
  const runId = (output as unknown as { runId: string }).runId;

  // Resume loop: drain the stream, collect any approval requests, resolve them,
  // and resume. Continue until a run completes without suspending.
  // The bound guards against an accidental infinite approval loop in a test.
  for (let iterations = 0; iterations < 50; iterations++) {
    const pendingApprovals: string[] = [];
    for await (const chunk of output.fullStream as AsyncIterable<ChunkType>) {
      chunks.push(chunk);
      if (chunk.type === 'tool-call-approval') {
        pendingApprovals.push((chunk.payload as { toolCallId: string }).toolCallId);
      }
    }

    if (pendingApprovals.length === 0) break;

    // Resolve the first pending approval; subsequent ones (if any) surface on
    // the next resume iteration.
    const toolCallId = pendingApprovals[0]!;
    const approve = decision({ toolCallId, approvalIndex: approvals.length });
    approvals.push(`${approve ? 'approve' : 'decline'}:${toolCallId}`);

    output = (await (approve
      ? agent.approveToolCall({ runId, toolCallId })
      : agent.declineToolCall({ runId, toolCallId }))) as unknown as MastraModelOutput<unknown>;
  }

  return {
    output,
    chunks,
    approvals,
    llm,
    requests: llm.getRequests(),
  };
}
