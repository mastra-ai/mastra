import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { Agent } from '../../agent';
import { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage';
import { Knowledge } from '../index';
import { KNOWLEDGE_READ_INSTRUCTIONS, KNOWLEDGE_WRITE_INSTRUCTIONS } from '../instructions';

type Call = { toolName: string; input: unknown } | { text: string };

function scriptedModel(calls: Call[], prompts: unknown[][]) {
  let step = 0;
  return new MockLanguageModelV2({
    doGenerate: async ({ prompt }) => {
      prompts.push(prompt as unknown[]);
      const call = calls[step++] ?? { text: 'Done.' };
      const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
      if ('text' in call) {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop' as const,
          usage,
          content: [{ type: 'text' as const, text: call.text }],
          warnings: [],
        };
      }
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'tool-calls' as const,
        usage,
        content: [
          {
            type: 'tool-call' as const,
            toolCallId: `call-${step}`,
            toolName: call.toolName,
            input: JSON.stringify(call.input),
          },
        ],
        warnings: [],
      };
    },
  });
}

function systemText(prompt: unknown[]): string {
  return prompt
    .filter((message: any) => message.role === 'system')
    .map((message: any) => message.content)
    .join('\n');
}

function toolResults(result: Awaited<ReturnType<Agent['generate']>>) {
  return result.steps.flatMap(step => step.toolResults.map(toolResult => toolResult.payload ?? toolResult));
}

describe('Knowledge attached to an Agent without Memory', () => {
  const requestContext = () => new RequestContext([['organizationId', 'acme']]);
  const runOptions = () => ({ memory: { thread: 'thread-1', resource: 'user-1' }, requestContext: requestContext() });

  it('gives the agent read and write tools and its usage instructions', async () => {
    const knowledge = new Knowledge({ storage: new InMemoryStore({ id: 'attach' }), tools: { write: true } });
    const prompts: unknown[][] = [];
    const agent = new Agent({
      id: 'writer',
      name: 'writer',
      instructions: 'You keep notes.',
      model: scriptedModel(
        [
          {
            toolName: 'knowledge_create',
            input: { name: 'Deploy policy', kind: 'policy', text: 'Deploys freeze on Fridays.' },
          },
          { toolName: 'knowledge_search', input: { query: 'Fridays' } },
          { text: 'Noted.' },
        ],
        prompts,
      ),
      knowledge,
    });

    expect(agent.hasOwnMemory()).toBe(false);
    const result = await agent.generate('Remember the Friday deploy freeze.', { maxSteps: 4, ...runOptions() });

    const [created, searched] = toolResults(result) as any[];
    expect(created.result.node.name).toBe('Deploy policy');
    expect(searched.result.results.map((hit: any) => hit.text)).toContain('Deploys freeze on Fridays.');

    const stored = await knowledge.listKnowledgeAbout({
      node: created.result.node.id,
      scope: ['org:acme', 'resource:user-1', 'thread:thread-1'],
    });
    expect(stored.records.map(record => record.text)).toEqual(['Deploys freeze on Fridays.']);

    const system = systemText(prompts[0]!);
    expect(system).toContain(KNOWLEDGE_READ_INSTRUCTIONS);
    expect(system).toContain(KNOWLEDGE_WRITE_INSTRUCTIONS);
  });

  it('attaches read tools only by default, and no instruction block when instructions is false', async () => {
    const prompts: unknown[][] = [];
    const agent = new Agent({
      id: 'reader',
      name: 'reader',
      instructions: 'You answer questions.',
      model: scriptedModel([{ toolName: 'knowledge_create', input: { name: 'x', kind: 'y', text: 'z' } }], prompts),
      knowledge: new Knowledge({ storage: new InMemoryStore({ id: 'reader' }), instructions: false }),
    });

    const result = await agent.generate('Hi', { maxSteps: 2, ...runOptions() });
    const tools = await agent.listTools();
    expect(Object.keys(tools)).toEqual([]);
    expect(toolResults(result)).toHaveLength(0);
    expect(systemText(prompts[0]!)).not.toContain(KNOWLEDGE_READ_INSTRUCTIONS);
  });

  it('resolves Knowledge registered on Mastra by key', async () => {
    const { Mastra } = await import('../../mastra');
    const knowledge = new Knowledge({ storage: new InMemoryStore({ id: 'registered' }) });
    const agent = new Agent({
      id: 'keyed',
      name: 'keyed',
      instructions: 'x',
      model: scriptedModel([], []),
      knowledge: 'company',
    });
    new Mastra({ agents: { keyed: agent }, knowledge: { company: knowledge }, logger: false });
    expect(agent.getKnowledge()).toBe(knowledge);
  });
});
