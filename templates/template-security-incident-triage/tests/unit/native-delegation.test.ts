import { MastraLanguageModelV2Mock } from '@mastra/core/test-utils/llm-mock';
import { describe, expect, it } from 'vitest';
import { createDelegatedInvestigator } from '../../src/mastra/agents/bounded-delegation.js';
import { createSocSupervisor } from '../../src/mastra/agents/soc-supervisor.js';
import { createIdentityInvestigator } from '../../src/mastra/agents/identity-investigator.js';
import { createEndpointInvestigator } from '../../src/mastra/agents/endpoint-investigator.js';
import { createCloudInvestigator } from '../../src/mastra/agents/cloud-investigator.js';

const output = {
  citedFactTokens: ['fact-1'],
  gaps: [],
  contradictionFlags: [],
};
const facts = [
  {
    factToken: 'fact-1',
    factTypeToken: 'type-1',
    valueToken: 'value-1',
    valueType: 'string' as const,
    sensitivity: 'internal' as const,
  },
];
const result = (text: string) => ({
  content: [{ type: 'text' as const, text }],
  finishReason: 'stop' as const,
  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
  warnings: [],
});
const call = (toolName: string, toolCallId = 'delegate-1') => ({
  type: 'tool-call' as const,
  toolCallId,
  toolName,
  input: JSON.stringify({
    prompt: 'INJECTED_PARENT_PROMPT',
    instructions: 'INJECTED_INSTRUCTIONS',
    maxSteps: 100,
  }),
});
function fixture(
  options: {
    calls?: string[];
    childText?: string;
    rogueChild?: boolean;
    parentText?: string;
  } = {},
) {
  const childModel = new MastraLanguageModelV2Mock({
    doGenerate: options.rogueChild
      ? {
          ...result(''),
          content: [call('identityReadTool')],
          finishReason: 'tool-calls',
        }
      : result(options.childText ?? JSON.stringify(output)),
  });
  let calls = 0;
  const parentModel = new MastraLanguageModelV2Mock({
    doGenerate: async () =>
      calls++ === 0 && options.calls?.length !== 0
        ? {
            ...result(''),
            content: (options.calls ?? ['agent-identityInvestigator']).map((name, index) =>
              call(name, `delegate-${index}`),
            ),
            finishReason: 'tool-calls',
          }
        : result(options.parentText ?? JSON.stringify(output)),
  });
  const child = createIdentityInvestigator(childModel);
  const parent = createSocSupervisor(parentModel, {
    identityInvestigator: child,
    endpointInvestigator: createEndpointInvestigator(childModel),
    cloudInvestigator: createCloudInvestigator(childModel),
  });
  return {
    child,
    childModel,
    parentModel,
    invoke: createDelegatedInvestigator(parent, 'identity'),
  };
}

describe('native bounded delegation', () => {
  it('executes a real child Agent and replaces model-authored context with server facts', async () => {
    const { invoke, childModel, parentModel } = fixture();
    expect(await invoke({ facts }, 1)).toEqual(output);
    expect(childModel.doGenerateCalls).toHaveLength(1);
    const prompt = JSON.stringify(childModel.doGenerateCalls[0]!.prompt);
    expect(prompt).toContain('fact-1');
    expect(prompt).toContain('citedFactTokens');
    expect(prompt).toContain('no Markdown or additional fields');
    expect(prompt).not.toMatch(/INJECTED_PARENT_PROMPT|INJECTED_INSTRUCTIONS/);
    expect(parentModel.doGenerateCalls).toHaveLength(2);
  });
  it('accepts a complete JSON code fence without relaxing the output contract', async () => {
    const fenced = '```json\n' + JSON.stringify(output) + '\n```';
    expect(await fixture({ childText: fenced, parentText: fenced }).invoke({ facts }, 1)).toEqual(output);
  });
  it.each([
    {
      name: 'commentary around JSON',
      childText: 'Here is the result: ' + JSON.stringify(output),
    },
    {
      name: 'fenced fabricated token',
      childText: '```json\n' + JSON.stringify({ ...output, citedFactTokens: ['fact-2'] }) + '\n```',
    },
    { name: 'unknown specialist', calls: ['agent-endpointInvestigator'] },
    {
      name: 'duplicate delegation',
      calls: ['agent-identityInvestigator', 'agent-identityInvestigator'],
    },
    { name: 'missing delegation', calls: [] },
    {
      name: 'nonexistent tool alongside allowed delegation',
      calls: ['unavailableTool', 'agent-identityInvestigator'],
    },
    {
      name: 'fabricated fact token',
      childText: JSON.stringify({ ...output, citedFactTokens: ['fact-2'] }),
    },
    {
      name: 'invented metadata',
      childText: JSON.stringify({ ...output, severity: 'critical' }),
    },
    {
      name: 'invented gap',
      childText: JSON.stringify({ ...output, gaps: ['invented'] }),
    },
    {
      name: 'parent changes child output',
      parentText: JSON.stringify({ ...output, citedFactTokens: [] }),
    },
  ])('rejects $name', async options => {
    await expect(fixture(options).invoke({ facts }, 1)).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
  });
  it('a rogue production-shaped child has no provider tool to execute', async () => {
    const { child, invoke, childModel } = fixture({ rogueChild: true });
    expect(await child.getToolsForExecution({})).toEqual({});
    await expect(invoke({ facts }, 1)).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
    expect(childModel.doGenerateCalls).toHaveLength(1);
    expect(childModel.doGenerateCalls[0]!.tools ?? []).toEqual([]);
  });
});
