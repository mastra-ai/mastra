import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../../agent';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage';
import { knowledgeMemoryScopes } from '../declarations';
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

function toolErrors(result: Awaited<ReturnType<Agent['generate']>>): string[] {
  return result.steps.flatMap(step =>
    step.content.flatMap((part: any) =>
      part.type === 'tool-result' && part.output?.type === 'error-text' ? [String(part.output.value)] : [],
    ),
  );
}

function toolResults(result: Awaited<ReturnType<Agent['generate']>>) {
  return result.steps.flatMap(step => step.toolResults.map(toolResult => toolResult.payload ?? toolResult));
}

const scopes = {
  ...knowledgeMemoryScopes(),
  'team:$orgId:$teamId': { access: [{ principal: 'self' as const, role: 'editor' as const }] },
};

// Agent scopes still carry an access flag; Knowledge refuses read-only entries, so these are written out.
const held = (...names: string[]) => names.map(scope => ({ scope, access: 'write' as const }));

describe('Knowledge attached to an Agent without Memory', () => {
  const runOptions = () => ({ memory: { thread: 'thread-1', resource: 'user-1' } });

  it('gives the agent read and write tools and its usage instructions', async () => {
    const knowledge = new Knowledge({ storage: new InMemoryStore({ id: 'attach' }), scopes, tools: true });
    const prompts: unknown[][] = [];
    const agent = new Agent({
      id: 'writer',
      name: 'writer',
      instructions: 'You keep notes.',
      model: scriptedModel(
        [
          { toolName: 'knowledge_page', input: { op: 'write', scope: 'org:acme', name: 'Deploy policy' } },
          {
            toolName: 'knowledge_note',
            input: { op: 'add', page: 'Deploy policy', scope: ['org:acme'], text: 'Deploys freeze on Fridays.' },
          },
          { toolName: 'knowledge_search', input: { query: 'Fridays' } },
          { text: 'Noted.' },
        ],
        prompts,
      ),
      knowledge,
      scopes: held('org:acme'),
    });

    expect(agent.hasOwnMemory()).toBe(false);
    const result = await agent.generate('Remember the Friday deploy freeze.', { maxSteps: 5, ...runOptions() });
    expect(toolErrors(result)).toEqual([]);

    const [created, , searched] = toolResults(result) as any[];
    expect(created.result.page.name).toBe('Deploy policy');
    expect(created.result.page.scope).toBe('org:acme');
    expect(JSON.stringify(searched.result.results)).toContain('Deploys freeze on Fridays.');

    const store = await knowledge.getStorage();
    const read = await knowledge.readScopeFor(['org:acme']);
    const page = await store.getPage({ id: created.result.page.id, read });
    expect(page?.name).toBe('Deploy policy');

    const system = systemText(prompts[0]!);
    expect(system).toContain(KNOWLEDGE_READ_INSTRUCTIONS);
    expect(system).toContain(KNOWLEDGE_WRITE_INSTRUCTIONS);
  });

  it('attaches no tools by default, and no instruction block when instructions is false', async () => {
    const prompts: unknown[][] = [];
    const agent = new Agent({
      id: 'reader',
      name: 'reader',
      instructions: 'You answer questions.',
      model: scriptedModel([{ toolName: 'knowledge_search', input: { query: 'x' } }], prompts),
      knowledge: new Knowledge({ storage: new InMemoryStore({ id: 'reader' }), scopes, instructions: false }),
    });

    const result = await agent.generate('Hi', { maxSteps: 2, ...runOptions() });
    const tools = await agent.listTools();
    expect(Object.keys(tools)).toEqual([]);
    expect(toolResults(result)).toHaveLength(0);
    expect(systemText(prompts[0]!)).not.toContain(KNOWLEDGE_READ_INSTRUCTIONS);
  });

  it('gives no tools by default; { read: true } the two read tools; true all four; pinnedContext adds knowledge_pin', () => {
    const names = (config: Omit<ConstructorParameters<typeof Knowledge>[0], 'scopes'>) =>
      Object.keys(new Knowledge({ ...config, scopes }).createTools()).sort();
    expect(names({})).toEqual([]);
    expect(new Knowledge({ scopes }).getInstructions()).not.toContain(KNOWLEDGE_READ_INSTRUCTIONS);
    expect(names({ tools: { read: true } })).toEqual(['knowledge_read', 'knowledge_search']);
    expect(names({ tools: { write: true } })).toEqual(['knowledge_note', 'knowledge_page']);
    expect(names({ tools: true })).toEqual(['knowledge_note', 'knowledge_page', 'knowledge_read', 'knowledge_search']);
    expect(names({ tools: true, pinnedContext: true })).toEqual([
      'knowledge_note',
      'knowledge_page',
      'knowledge_pin',
      'knowledge_read',
      'knowledge_search',
    ]);
  });

  it('requires scopes, pointing at knowledgeMemoryScopes', () => {
    expect(() => new Knowledge({} as never)).toThrow(/knowledgeMemoryScopes/);
    expect(() => new Knowledge({ scopes: {} })).not.toThrow();
  });

  it('resolves Knowledge registered on Mastra by key', async () => {
    const { Mastra } = await import('../../mastra');
    const knowledge = new Knowledge({ storage: new InMemoryStore({ id: 'registered' }), scopes });
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

  it('scopes tools by the run scopes: a run on another team sees nothing and cannot write there', async () => {
    const knowledge = new Knowledge({ storage: new InMemoryStore({ id: 'teams' }), scopes, tools: true });
    const agentFor = (team: string, calls: Call[]) =>
      new Agent({
        id: team,
        name: team,
        instructions: 'x',
        model: scriptedModel(calls, []),
        knowledge,
        scopes: held('org:acme', `team:acme:${team}`),
      });

    const wrote = await agentFor('support', [
      {
        toolName: 'knowledge_page',
        input: { op: 'write', scope: 'team:acme:support', name: 'Plan', body: 'Ship Friday.' },
      },
    ]).generate('write', { maxSteps: 2, ...runOptions() });
    expect(toolErrors(wrote)).toEqual([]);

    const search = async (team: string) => {
      const result = await agentFor(team, [{ toolName: 'knowledge_search', input: { query: 'Plan' } }]).generate('q', {
        maxSteps: 2,
        ...runOptions(),
      });
      return (toolResults(result)[0] as any).result.results.map((hit: any) => hit.page.name);
    };
    expect(await search('support')).toEqual(['Plan']);
    expect(await search('sales')).toEqual([]);

    const refused = await agentFor('sales', [
      { toolName: 'knowledge_page', input: { op: 'write', scope: 'team:acme:support', name: 'Sneaky' } },
    ]).generate('write', { maxSteps: 2, ...runOptions() });
    expect(toolErrors(refused).join('\n')).toMatch(/not found/);
  });

  it('fails closed on a read-only scope entry instead of ignoring it', async () => {
    const knowledge = new Knowledge({ storage: new InMemoryStore({ id: 'ro' }), scopes, tools: true });
    const agent = new Agent({
      id: 'ro',
      name: 'ro',
      instructions: 'x',
      model: scriptedModel([{ toolName: 'knowledge_search', input: { query: 'x' } }], []),
      knowledge,
      scopes: [{ scope: 'org:acme', access: 'read' }],
    });
    const result = await agent.generate('q', { maxSteps: 2, ...runOptions() });
    expect(toolErrors(result).join('\n')).toMatch(/Read-only scope entries were removed/);
  });

  it('delivers pinned pages to an agent with Memory, on the next call after pinning', async () => {
    const knowledge = new Knowledge({
      storage: new InMemoryStore({ id: 'pins' }),
      scopes,
      tools: true,
      pinnedContext: true,
    });
    const prompts: unknown[][] = [];
    const agent = (calls: Call[]) =>
      new Agent({
        id: 'pinner',
        name: 'pinner',
        instructions: 'x',
        model: scriptedModel(calls, prompts),
        knowledge,
        memory: new MockMemory(),
        scopes: held('org:acme'),
      });
    const pinned = await agent([
      {
        toolName: 'knowledge_page',
        input: { op: 'write', scope: 'org:acme', name: 'Tone', body: 'Answer in French.' },
      },
      { toolName: 'knowledge_pin', input: { op: 'pin', page: 'Tone', audience: ['org:acme'] } },
    ]).generate('pin', { maxSteps: 3, ...runOptions() });
    expect(toolErrors(pinned)).toEqual([]);
    expect(JSON.stringify(prompts[0])).not.toContain('Answer in French.');

    prompts.length = 0;
    await agent([]).generate('hello', { maxSteps: 1, memory: { thread: 'thread-2', resource: 'user-1' } });
    expect(JSON.stringify(prompts[0])).toContain('<pinned-knowledge');
    expect(JSON.stringify(prompts[0])).toContain('Answer in French.');
  });

  it('warns and delivers no pins to an agent without Memory', async () => {
    const knowledge = new Knowledge({
      storage: new InMemoryStore({ id: 'no-mem' }),
      scopes,
      tools: true,
      pinnedContext: true,
    });
    const prompts: unknown[][] = [];
    const writer = new Agent({
      id: 'no-mem',
      name: 'no-mem',
      instructions: 'x',
      model: scriptedModel(
        [
          {
            toolName: 'knowledge_page',
            input: { op: 'write', scope: 'org:acme', name: 'Tone', body: 'Answer in French.' },
          },
          { toolName: 'knowledge_pin', input: { op: 'pin', page: 'Tone', audience: ['org:acme'] } },
        ],
        prompts,
      ),
      knowledge,
      scopes: held('org:acme'),
    });
    const warn = vi.spyOn((writer as unknown as { logger: { warn: (message: string) => void } }).logger, 'warn');
    const result = await writer.generate('pin', { maxSteps: 4, ...runOptions() });
    expect(toolErrors(result)).toEqual([]);
    await writer.generate('again', { maxSteps: 1, ...runOptions() });
    expect(JSON.stringify(prompts.at(-1))).not.toContain('<pinned-knowledge');
    expect(warn.mock.calls.filter(([message]) => String(message).includes('pinnedContext needs Memory'))).toHaveLength(
      1,
    );
  });
});
