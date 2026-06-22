import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { Agent } from '../../../agent';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage';
import type { MastraModelOutput } from '../../../stream/base/output';
import type { ChunkType } from '../../../stream/types';
import type { LoopScenarioResult, RunApprovalScenarioOptions, RunLoopScenarioOptions } from './types';
import { SCENARIO_MODEL_ID } from './types';

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
  > = {},
): Promise<{ agent: Agent; mastra: any }> {
  return buildScenarioAgent({ llm, ...opts });
}

/**
 * Build an {@link Agent} backed by a real OpenAI v5 provider pointed at the
 * in-test AIMock server, registered on a {@link Mastra} instance with storage
 * so suspend/resume (tool approval) works.
 */
async function buildScenarioAgent({
  llm,
  tools,
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
}: Pick<
  RunLoopScenarioOptions,
  | 'llm'
  | 'tools'
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
>): Promise<{ agent: Agent; mastra: any }> {
  const openai = createOpenAI({
    apiKey: 'aimock-test-key',
    baseURL: `${llm.url.replace(/\/+$/, '')}/v1`,
  });

  // Unique id per run so repeated scenarios in one suite don't collide on the
  // Mastra agent registry.
  const agentId = `aimock-loop-scenario-agent-${++scenarioAgentCounter}`;

  // Use dynamic model function if provided, otherwise use default AIMock-backed model
  const modelConfig = model ?? openai(SCENARIO_MODEL_ID);

  const agent = new Agent({
    id: agentId,
    name: 'AIMock Loop Scenario Agent',
    instructions: instructions ?? 'You are a test agent driven by scripted AIMock responses.',
    model: modelConfig,
    ...(tools ? { tools } : {}),
    ...(memory ? { memory } : {}),
    ...(workspace ? { workspace } : {}),
    ...(agents ? { agents } : {}),
    ...(workflows ? { workflows } : {}),
    ...(agentBackgroundTasks ? { backgroundTasks: agentBackgroundTasks } : {}),
    ...(goal ? { goal } : {}),
    ...(errorProcessors ? { errorProcessors } : {}),
    ...(defaultOptions ? { defaultOptions } : {}),
  });

  // Registering the agent on a Mastra instance with storage is required for the
  // suspended snapshot rows that approveToolCall/declineToolCall resume from.
  const mastra = new Mastra({
    agents: { [agentId]: agent },
    logger: false,
    storage: new InMemoryStore(),
    ...(backgroundTasks ? { backgroundTasks } : {}),
    ...(pubsub ? { pubsub } : {}),
  });

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
 * This mirrors how mastracode's e2e harness routes the real provider at AIMock
 * through `OPENAI_BASE_URL`, but stays in `packages/core` and asserts on loop
 * output instead of TUI screen text.
 */
export async function runLoopScenario({
  llm,
  fixtures,
  prompt,
  tools,
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
  onStepFinish,
  onFinish,
  savePerStep,
  actor,
  defaultOptions,
  sharedAgent,
  pubsub,
}: RunLoopScenarioOptions): Promise<LoopScenarioResult> {
  fixtures(llm);

  // Use shared agent/mastra if provided (for suspend/resume flows across calls),
  // otherwise build a fresh one.
  let agent: any;
  let mastra: any;
  if (sharedAgent) {
    agent = sharedAgent.agent;
    mastra = sharedAgent.mastra;
  } else {
    const built = await buildScenarioAgent({
      llm,
      tools,
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

  const streamOptions = {
    ...(stopWhen ? { stopWhen } : {}),
    ...(maxSteps ? { maxSteps } : {}),
    ...(isTaskComplete ? { isTaskComplete } : {}),
    ...(structuredOutput ? { structuredOutput } : {}),
    ...(activeTools ? { activeTools } : {}),
    ...(outputProcessors ? { outputProcessors } : {}),
    ...(inputProcessors ? { inputProcessors } : {}),
    ...(prepareStep ? { prepareStep } : {}),
    ...(requestContext ? { requestContext } : {}),
    ...(delegation ? { delegation } : {}),
    ...(onIterationComplete ? { onIterationComplete } : {}),
    ...(onStepFinish ? { onStepFinish } : {}),
    ...(onFinish ? { onFinish } : {}),
    ...(onError ? { onError } : {}),
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

  const output = (streamUntilIdle
    ? await agent.streamUntilIdle(prompt, streamOptions)
    : await agent.stream(prompt, streamOptions)) as unknown as MastraModelOutput<unknown>;

  // Drain the stream so every loop turn (and every AIMock request) completes
  // before we hand back the captured journal.
  let chunks: ChunkType[] | undefined;
  if (manualStreamConsumption) {
    // Skip consumption — test will manually drain the stream after publishing events.
  } else if (collectChunks) {
    chunks = [];
    for await (const chunk of output.fullStream as AsyncIterable<ChunkType>) {
      chunks.push(chunk);
    }
  } else {
    await output.consumeStream();
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
