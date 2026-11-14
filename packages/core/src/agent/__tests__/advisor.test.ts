/**
 * Tests for the opt-in `advisor` option and the framework-provided `ask_advisor` tool.
 *
 * The advisor lets a running agent consult a stronger model mid-run. Each consult is a
 * single, tool-less model call whose usage is reported separately from the executor's.
 */
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../tools';
import { Agent } from '../agent';

type Usage = { inputTokens: number; outputTokens: number; totalTokens: number };

const EXECUTOR_USAGE: Usage = { inputTokens: 3, outputTokens: 2, totalTokens: 5 };
const EXECUTOR_FINAL_USAGE: Usage = { inputTokens: 4, outputTokens: 6, totalTokens: 10 };
const ADVISOR_USAGE: Usage = { inputTokens: 40, outputTokens: 60, totalTokens: 100 };

type StepSpec =
  | { kind: 'text'; text: string; usage: Usage }
  | { kind: 'tool'; toolName: string; toolCallId: string; usage: Usage };

function streamPartsFor(modelId: string, step: StepSpec) {
  const body =
    step.kind === 'text'
      ? [
          { type: 'text-start' as const, id: 'text-1' },
          { type: 'text-delta' as const, id: 'text-1', delta: step.text },
          { type: 'text-end' as const, id: 'text-1' },
          { type: 'finish' as const, finishReason: 'stop' as const, usage: step.usage },
        ]
      : [
          {
            type: 'tool-call' as const,
            toolCallType: 'function' as const,
            toolCallId: step.toolCallId,
            toolName: step.toolName,
            input: '{}',
          },
          { type: 'finish' as const, finishReason: 'tool-calls' as const, usage: step.usage },
        ];

  return convertArrayToReadableStream([
    { type: 'stream-start' as const, warnings: [] },
    { type: 'response-metadata' as const, id: 'id-0', modelId, timestamp: new Date(0) },
    ...body,
  ]);
}

function generateResultFor(step: StepSpec) {
  const content =
    step.kind === 'text'
      ? [{ type: 'text' as const, text: step.text }]
      : [{ type: 'tool-call' as const, toolCallId: step.toolCallId, toolName: step.toolName, input: '{}' }];

  return {
    rawCall: { rawPrompt: null, rawSettings: {} },
    warnings: [],
    finishReason: step.kind === 'text' ? ('stop' as const) : ('tool-calls' as const),
    usage: step.usage,
    content,
  };
}

/** Model that answers a single fixed text. */
function textModel(modelId: string, text: string, usage: Usage = ADVISOR_USAGE) {
  const step: StepSpec = { kind: 'text', text, usage };
  return new MockLanguageModelV2({
    modelId,
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: streamPartsFor(modelId, step),
    }),
    doGenerate: async () => generateResultFor(step),
  });
}

/**
 * Executor model that requests each tool in `toolNames` once, in order, before finishing
 * with `finalText`. Each step reports its own usage so total executor usage is predictable.
 */
function scriptedExecutorModel(modelId: string, toolNames: string[], finalText: string) {
  let call = 0;
  const nextStep = (): StepSpec => {
    const index = call++;
    if (index < toolNames.length) {
      return { kind: 'tool', toolName: toolNames[index]!, toolCallId: `tc-${index + 1}`, usage: EXECUTOR_USAGE };
    }
    return { kind: 'text', text: finalText, usage: EXECUTOR_FINAL_USAGE };
  };
  return new MockLanguageModelV2({
    modelId,
    doStream: async () => {
      const step = nextStep();
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: streamPartsFor(modelId, step),
      };
    },
    doGenerate: async () => generateResultFor(nextStep()),
  });
}

/** Executor model that requests `toolName` `toolCalls` times before finishing. */
function toolThenTextModel(modelId: string, toolName: string, finalText: string, toolCalls = 1) {
  return scriptedExecutorModel(
    modelId,
    Array.from({ length: toolCalls }, () => toolName),
    finalText,
  );
}

function makeAgent(overrides: Record<string, unknown>) {
  return new Agent({
    id: 'advisor-test-agent',
    name: 'Advisor Test Agent',
    instructions: 'You are a research agent.',
    model: textModel('executor-default', 'done'),
    ...overrides,
  } as ConstructorParameters<typeof Agent>[0]);
}

describe('advisor option', () => {
  it('registers ask_advisor only when an advisor is configured', async () => {
    const withAdvisor = makeAgent({
      model: textModel('executor', 'done'),
      advisor: { model: textModel('advisor', 'guidance') },
    });
    const withoutAdvisor = makeAgent({ model: textModel('executor', 'done') });

    const toolsWithAdvisor = await withAdvisor.listTools();
    const toolsWithoutAdvisor = await withoutAdvisor.listTools();

    expect(Object.keys(toolsWithAdvisor)).toContain('ask_advisor');
    expect(Object.keys(toolsWithoutAdvisor)).not.toContain('ask_advisor');
  });

  it('lets a user-declared ask_advisor tool win over the framework tool', async () => {
    const userTool = createTool({
      id: 'ask_advisor',
      description: 'User-provided advisor.',
      inputSchema: z.object({}),
      outputSchema: z.object({ text: z.string() }),
      execute: async () => ({ text: 'user tool' }),
    });

    const agent = makeAgent({
      tools: { ask_advisor: userTool },
      advisor: { model: textModel('advisor', 'guidance') },
    });

    const tools = await agent.listTools();
    expect(tools.ask_advisor).toBe(userTool);
  });

  it('consults the advisor and returns its guidance as the tool result', async () => {
    const advisorModel = textModel('advisor', 'Trust source A; re-fetch source B.');
    const executorModel = toolThenTextModel('executor', 'ask_advisor', 'Finished with the plan.');

    const agent = makeAgent({ model: executorModel, advisor: { model: advisorModel } });
    const result = await agent.generate('Which source should I trust?');

    expect(result.text).toContain('Finished with the plan.');
    expect(advisorModel.doGenerateCalls).toHaveLength(1);

    // The advisor's reply is handed back to the executor as the tool result, so the
    // executor's second model call sees it in the prompt.
    const secondCallPrompt = JSON.stringify(executorModel.doGenerateCalls[1]?.prompt ?? []);
    expect(secondCallPrompt).toContain('Trust source A; re-fetch source B.');
  });

  it('forwards the executor instructions to the advisor', async () => {
    const advisorModel = textModel('advisor', 'guidance');
    const executorModel = toolThenTextModel('executor', 'ask_advisor', 'done');

    const agent = makeAgent({
      instructions: 'You are a very specific research agent named Lookup.',
      model: executorModel,
      advisor: { model: advisorModel },
    });
    await agent.generate('help');

    const advisorPrompt = JSON.stringify(advisorModel.doGenerateCalls[0]?.prompt ?? []);
    expect(advisorPrompt).toContain('You are a very specific research agent named Lookup.');
  });

  it('shows the advisor the executor transcript, including earlier tool results', async () => {
    const advisorModel = textModel('advisor', 'guidance');
    const lookup = createTool({
      id: 'lookup',
      description: 'Look something up.',
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string() }),
      execute: async () => ({ value: 'source-A-says-42' }),
    });
    const executorModel = scriptedExecutorModel('executor', ['lookup', 'ask_advisor'], 'done');

    const agent = makeAgent({ tools: { lookup }, model: executorModel, advisor: { model: advisorModel } });
    await agent.generate('help');

    // The tool result ran in this same run, so it only reaches the advisor if the
    // framework hands it the full step prompt rather than the input-only prompt.
    const advisorPrompt = JSON.stringify(advisorModel.doGenerateCalls[0]?.prompt ?? []);
    expect(advisorPrompt).toContain('source-A-says-42');
  });

  it('stops consulting once maxUses is reached without failing the run', async () => {
    const advisorModel = textModel('advisor', 'guidance');
    const executorModel = toolThenTextModel('executor', 'ask_advisor', 'done anyway', 2);

    const agent = makeAgent({ model: executorModel, advisor: { model: advisorModel, maxUses: 1 } });
    const result = await agent.generate('help');

    expect(result.text).toContain('done anyway');
    // Only the first consult reaches the advisor; the second is short-circuited.
    expect(advisorModel.doGenerateCalls).toHaveLength(1);

    const finalCallPrompt = JSON.stringify(executorModel.doGenerateCalls.at(-1)?.prompt ?? []);
    expect(finalCallPrompt).toContain('Advisor consult limit reached');
  });

  it('reports advisor usage separately from the executor', async () => {
    const advisorModel = textModel('advisor', 'guidance', ADVISOR_USAGE);
    const executorModel = toolThenTextModel('executor', 'ask_advisor', 'done');

    const agent = makeAgent({ model: executorModel, advisor: { model: advisorModel } });
    const result = await agent.generate('help');

    // Executor usage covers only its own two steps, not the advisor's 100 tokens.
    const executorTotal = result.totalUsage?.totalTokens ?? 0;
    expect(executorTotal).toBe(EXECUTOR_USAGE.totalTokens + EXECUTOR_FINAL_USAGE.totalTokens);
    expect(executorTotal).not.toBe(
      EXECUTOR_USAGE.totalTokens + EXECUTOR_FINAL_USAGE.totalTokens + ADVISOR_USAGE.totalTokens,
    );
  });

  it('returns an error-shaped result instead of failing when the advisor errors', async () => {
    const advisorModel = new MockLanguageModelV2({
      modelId: 'advisor-failing',
      doStream: async () => {
        throw new Error('advisor is down');
      },
      doGenerate: async () => {
        throw new Error('advisor is down');
      },
    });
    const executorModel = toolThenTextModel('executor', 'ask_advisor', 'carried on');

    const agent = makeAgent({ model: executorModel, advisor: { model: advisorModel } });
    const result = await agent.generate('help');

    expect(result.text).toContain('carried on');
    const secondCallPrompt = JSON.stringify(executorModel.doGenerateCalls[1]?.prompt ?? []);
    expect(secondCallPrompt).toContain('Advisor unavailable');
  });
});
