import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { z } from 'zod/v4';
import { Agent } from '../../../../agent';
import { Mastra } from '../../../../mastra';
import { createTool } from '../../../../tools';
import { executeTarget } from '../../executor';
import type { ExecutionResult } from '../../executor';
import type { ItemToolMock } from '../../tool-mocks';

/**
 * A single scripted model turn: the content the model returns when asked.
 *
 * - `toolCalls` makes the model issue tool calls (which the loop will run, or
 *   which item tool-mocks may intercept).
 * - `text` makes the model emit a final assistant message and stop.
 */
export type ScriptedTurn = { toolCalls: { id: string; toolName: string; args: unknown }[] } | { text: string };

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

  return new MockLanguageModelV2({
    doGenerate: async () => {
      const turn = nextTurn();
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
      const turn = nextTurn();
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
}

/**
 * Run one dataset item through the REAL experiment executor against a REAL agent
 * whose only fake is the scripted model. Returns the executor's
 * {@link ExecutionResult} (output, error code, toolMockReport).
 */
export async function runToolMockScenario(opts: RunToolMockScenarioOptions): Promise<ExecutionResult> {
  const agentId = `tool-mock-scenario-agent-${++counter}`;
  const agent = new Agent({
    id: agentId,
    name: 'Tool Mock Scenario Agent',
    instructions: 'You are a test agent driven by a scripted model.',
    model: scriptedModel(opts.turns),
    tools: opts.tools,
  });
  const mastra = new Mastra({ agents: { [agentId]: agent }, logger: false });

  return executeTarget(
    mastra.getAgent(agentId),
    'agent',
    { input: opts.prompt ?? 'run the scenario' },
    { toolMocks: opts.toolMocks },
  );
}

let counter = 0;
