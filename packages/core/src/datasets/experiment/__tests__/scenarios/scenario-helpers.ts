import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { z } from 'zod/v4';
import { Agent } from '../../../../agent';
import type { MastraModelConfig } from '../../../../llm/model/shared.types';
import { Mastra } from '../../../../mastra';
import { InMemoryStore } from '../../../../storage';
import type { ExperimentResult } from '../../../../storage/types';
import { createTool } from '../../../../tools';
import { runExperiment } from '../../index';
import type { ItemToolMock, UnmockedToolPolicy } from '../../tool-mocks';
import type { ExperimentSummary } from '../../types';

/**
 * A single scripted model turn: the content the model returns when asked.
 *
 * - `toolCalls` makes the model issue tool calls (which the loop will run, or
 *   which item tool-mocks may intercept).
 * - `text` makes the model emit a final assistant message and stop, after `delayMs` if set.
 * - `throws` makes the model call fail with that message (a provider error).
 */
export type ScriptedTurn =
  | { toolCalls: { id: string; toolName: string; args: unknown }[] }
  | { text: string; delayMs?: number }
  | { throws: string };

/**
 * Build a {@link MockLanguageModelV2} that plays the given turns in order, one
 * per loop step. The last turn should be a `{ text }` turn so the agentic loop
 * terminates. This is the single mocked seam — everything else (tool wrapping,
 * the experiment executor, the mock matcher) is the real system.
 */
export function scriptedModel(turns: ScriptedTurn[]): MockLanguageModelV2 {
  if (turns.length === 0) {
    throw new Error('scriptedModel requires at least one turn');
  }

  // The experiment executor calls `agent.generate()` (the `doGenerate` path), but
  // wire up `doStream` too so the same model works regardless of execution path.
  // A single counter advances one turn per model invocation.
  let step = 0;
  const nextTurn = (): ScriptedTurn => {
    const turn = turns[Math.min(step, turns.length - 1)]!;
    step += 1;
    return turn;
  };

  const playTurn = async (turn: ScriptedTurn) => {
    if ('throws' in turn) throw new Error(turn.throws);
    if ('delayMs' in turn && turn.delayMs) await new Promise(resolve => setTimeout(resolve, turn.delayMs));
    return turn;
  };

  return new MockLanguageModelV2({
    doGenerate: async () => {
      const turn = await playTurn(nextTurn());
      if ('text' in turn) {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          content: [{ type: 'text', text: turn.text }],
          warnings: [],
        };
      }
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'tool-calls',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        content: turn.toolCalls.map(c => ({
          type: 'tool-call' as const,
          toolCallType: 'function' as const,
          toolCallId: c.id,
          toolName: c.toolName,
          input: JSON.stringify(c.args),
        })),
        warnings: [],
      };
    },
    doStream: async () => {
      const turn = await playTurn(nextTurn());
      if ('text' in turn) {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: `id-${step}`, modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'txt-0' },
            { type: 'text-delta', id: 'txt-0', delta: turn.text },
            { type: 'text-end', id: 'txt-0' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      }

      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: `id-${step}`, modelId: 'mock-model-id', timestamp: new Date(0) },
          ...turn.toolCalls.map(c => ({
            type: 'tool-call' as const,
            toolCallId: c.id,
            toolName: c.toolName,
            input: JSON.stringify(c.args),
            providerExecuted: false,
          })),
          { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
}

/** A tool that records every live execution into `liveLog` so scenarios can assert it never ran. */
export function recordingTool(id: string, liveLog: string[]) {
  return createTool({
    id,
    description: `Test tool ${id}`,
    inputSchema: z.object({}).passthrough(),
    execute: async (input: Record<string, unknown>) => {
      liveLog.push(id);
      return { live: true, tool: id, input };
    },
  });
}

export interface RunToolMockScenarioOptions {
  /** The scripted model turns (tool calls then a final text turn). */
  turns: ScriptedTurn[];
  /** Tools registered on the agent, keyed by the name the model calls. */
  tools: Record<string, ReturnType<typeof createTool>>;
  /** Item-level static tool mocks under test. */
  toolMocks?: ItemToolMock[];
  /** Prompt for the dataset item input. */
  prompt?: string;
  /** Max retries for the experiment run (default 0). Used by retry-skip scenarios. */
  maxRetries?: number;
  /** Per-item timeout in milliseconds. */
  itemTimeout?: number;
  /** Run-level handling of tool calls the item doesn't mock. */
  unmockedToolPolicy?: UnmockedToolPolicy;
  /** Item-level handling of tool calls the item doesn't mock (wins over the run level). */
  itemUnmockedToolPolicy?: UnmockedToolPolicy;
  /** Per-call model override for the agent. */
  agentModel?: MastraModelConfig;
  /** How the experiment runs. Defaults to `runExperiment`. */
  path?: ExperimentPath;
}

/**
 * The ways an experiment item can run. Scenarios run on every path so a run option
 * supported by one path can't silently be ignored by another.
 * - `runExperiment`: Mastra owns the loop, in process.
 * - `runExperimentItem`: the caller owns the loop and asks Mastra to run each item.
 */
export const EXPERIMENT_PATHS = ['runExperiment', 'runExperimentItem'] as const;
export type ExperimentPath = (typeof EXPERIMENT_PATHS)[number];

/**
 * Result of a single-item scenario run: the full {@link ExperimentSummary} plus
 * the single {@link ItemWithScores} result for convenient per-item assertions.
 */
export interface ToolMockScenarioResult {
  /** The finished experiment (status, succeededCount, failedCount, ...). */
  summary: Pick<ExperimentSummary, 'status' | 'succeededCount' | 'failedCount'>;
  /** The single item result as persisted (output, error, toolMockReport, retryCount, ...). */
  item: ExperimentResult;
}

/**
 * Run one dataset item through a REAL experiment path (see {@link EXPERIMENT_PATHS})
 * against a REAL agent whose only fake is the scripted model.
 *
 * The dataset item (carrying the tool mocks under test) is persisted to a real
 * {@link InMemoryStore} first, then the experiment runs by `datasetId` — the
 * same storage-backed path Studio uses, where `toolMocks` are read off the
 * persisted `DatasetItemRow` rather than passed inline. Retry-skip and report
 * persistence therefore exercise the same code paths as production.
 *
 * Returns the finished experiment and the single item result read back from storage.
 */
export async function runToolMockScenario(opts: RunToolMockScenarioOptions): Promise<ToolMockScenarioResult> {
  const agentId = `tool-mock-scenario-agent-${++counter}`;
  const agent = new Agent({
    id: agentId,
    name: 'Tool Mock Scenario Agent',
    instructions: 'You are a test agent driven by a scripted model.',
    model: scriptedModel(opts.turns),
    tools: opts.tools,
  });
  const storage = new InMemoryStore();
  const mastra = new Mastra({
    agents: { [agentId]: agent },
    storage,
    logger: false,
  });

  const datasetsStore = (await storage.getStore('datasets'))!;
  const dataset = await datasetsStore.createDataset({ name: `Tool Mock Scenario DS ${counter}` });
  const datasetItem = await datasetsStore.addItem({
    datasetId: dataset.id,
    input: opts.prompt ?? 'run the scenario',
    toolMocks: opts.toolMocks,
    unmockedToolPolicy: opts.itemUnmockedToolPolicy,
  });

  const runOptions = {
    maxRetries: opts.maxRetries ?? 0,
    itemTimeout: opts.itemTimeout,
    unmockedToolPolicy: opts.unmockedToolPolicy,
    agentModel: opts.agentModel,
  };
  const path = opts.path ?? 'runExperiment';

  if (path === 'runExperiment') {
    const summary = await runExperiment(mastra, {
      targetType: 'agent',
      targetId: agentId,
      datasetId: dataset.id,
      scorers: [],
      maxConcurrency: 1,
      ...runOptions,
    });
    return { summary, item: await persistedResult(mastra, summary.experimentId) };
  }

  // Caller-driven: the caller owns the loop and Mastra runs each item.
  const ds = await mastra.datasets.get({ id: dataset.id });
  const { experimentId } = await ds.createExperiment({ targetType: 'agent', targetId: agentId, scorers: [] });
  await ds.runExperimentItem({ experimentId, itemId: datasetItem.id, ...runOptions });
  const summary = await ds.finalizeExperiment({ experimentId });
  return { summary, item: await persistedResult(mastra, experimentId) };
}

async function persistedResult(mastra: Mastra, experimentId: string): Promise<ExperimentResult> {
  const experimentsStore = (await mastra.getStorage()!.getStore('experiments'))!;
  const { results } = await experimentsStore.listExperimentResults({
    experimentId,
    pagination: { page: 0, perPage: 10 },
  });
  if (results.length !== 1) throw new Error(`expected one persisted result, got ${results.length}`);
  return results[0]!;
}

let counter = 0;
