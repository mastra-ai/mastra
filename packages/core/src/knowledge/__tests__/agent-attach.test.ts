import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { Agent } from '../../agent';
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

describe('Knowledge attached to an Agent without Memory', () => {
  const runOptions = () => ({ memory: { thread: 'thread-1', resource: 'user-1' } });

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
      scopes: ['org:acme'],
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

  it('scopes tools by the run tags: another run with different tags sees nothing', async () => {
    const knowledge = new Knowledge({ storage: new InMemoryStore({ id: 'tags' }), tools: { write: true } });
    const writer = new Agent({
      id: 'writer',
      name: 'writer',
      instructions: 'x',
      model: scriptedModel(
        [
          {
            toolName: 'knowledge_create',
            input: { name: 'Plan', kind: 'doc', text: 'Ship Friday.', scope: ['team:acme:support'] },
          },
        ],
        [],
      ),
      knowledge,
      scopes: ['team:acme:support', 'agent:alex'],
    });
    const result = await writer.generate('Note it.', { maxSteps: 2, memory: { thread: 'w-1', resource: 'alex' } });
    const [created] = toolResults(result) as any[];
    expect(created.result.record.scope).toEqual(['team:acme:support']);

    const search = (scopes: string[]) =>
      new Agent({
        id: 'reader',
        name: 'reader',
        instructions: 'x',
        model: scriptedModel([{ toolName: 'knowledge_search', input: { query: 'Friday' } }], []),
        knowledge,
        scopes,
      })
        .generate('Find it.', { maxSteps: 2, memory: { thread: 'r-1', resource: 'sam' } })
        .then(run => (toolResults(run)[0] as any).result.results.map((hit: any) => hit.text));

    expect(await search(['team:acme:support'])).toContain('Ship Friday.');
    expect(await search(['team:acme:sales'])).toEqual([]);
  });

  it('refuses a write naming a tag the run does not hold', async () => {
    const knowledge = new Knowledge({ storage: new InMemoryStore({ id: 'refuse' }), tools: { write: true } });
    const agent = new Agent({
      id: 'writer',
      name: 'writer',
      instructions: 'x',
      model: scriptedModel(
        [{ toolName: 'knowledge_create', input: { name: 'X', kind: 'doc', text: 'y', scope: ['team:acme:sales'] } }],
        [],
      ),
      knowledge,
      scopes: ['team:acme:support'],
    });
    const result = await agent.generate('x', { maxSteps: 2, memory: { thread: 't', resource: 'r' } });
    expect(toolResults(result)).toHaveLength(0);
    expect(JSON.stringify(result.steps.map(step => step.content))).toContain('does not hold scope');
    expect(await (await knowledge.getStorage()).listNodes({ scope: ['team:acme:sales'] })).toEqual([]);
  });

  it('holds a read-only tag for reads only: visible, left out of default writes, refused when named', async () => {
    const storage = new InMemoryStore({ id: 'read-only' });
    const knowledge = new Knowledge({ storage, tools: { write: true } });
    const store = await knowledge.getStorage();
    const orgNode = await store.createNode({ name: 'Org policy', kind: 'policy', scope: ['org:self'] });
    await store.appendKnowledge({
      node: orgNode,
      text: 'Ship on Fridays only with sign-off.',
      scope: ['org:self'],
      sourceThreadId: 'director',
      resolutionScope: ['org:self'],
      defaultScope: ['org:self'],
    });

    const member = (calls: Call[]) =>
      new Agent({
        id: 'member',
        name: 'member',
        instructions: 'x',
        model: scriptedModel(calls, []),
        knowledge,
        scopes: [{ tag: 'org:self', access: 'read' }, 'team:self:x'],
      }).generate('go', { maxSteps: 2, memory: { thread: 'm-1', resource: 'member' } });

    const searched = await member([{ toolName: 'knowledge_search', input: { query: 'Fridays' } }]);
    expect((toolResults(searched)[0] as any).result.results.map((hit: any) => hit.text)).toContain(
      'Ship on Fridays only with sign-off.',
    );

    const created = await member([
      { toolName: 'knowledge_create', input: { name: 'Team note', kind: 'doc', text: 'x' } },
    ]);
    expect((toolResults(created)[0] as any).result.record.scope).toEqual([
      'resource:member',
      'team:self:x',
      'thread:m-1',
    ]);

    const named = await member([
      { toolName: 'knowledge_create', input: { name: 'Org note', kind: 'doc', text: 'y', scope: ['org:self'] } },
    ]);
    expect(toolErrors(named)).toEqual(['"org:self" is read-only for this run.']);

    const appended = await member([{ toolName: 'knowledge_append', input: { node: orgNode.id, text: 'z' } }]);
    expect(toolErrors(appended)).toEqual(['"org:self" is read-only for this run.']);
  });

  it('delivers pins to an agent without Memory within the call that pins and on the next call', async () => {
    const knowledge = new Knowledge({ storage: new InMemoryStore({ id: 'pins-no-memory' }), pins: true });
    const prompts: unknown[][] = [];
    const agent = (calls: Call[]) =>
      new Agent({
        id: 'pins',
        name: 'pins',
        instructions: 'x',
        model: scriptedModel(calls, prompts),
        knowledge,
        scopes: ['team:acme:x'],
      });
    expect(agent([]).hasOwnMemory()).toBe(false);

    const noThread = await agent([{ toolName: 'knowledge_pin', input: { text: 'x' } }]).generate('pin', {
      maxSteps: 2,
    });
    expect(toolErrors(noThread)).toEqual(['Knowledge tools require an active threadId.']);
    prompts.length = 0;

    const pinned = await agent([{ toolName: 'knowledge_pin', input: { text: 'Always answer in French.' } }]).generate(
      'pin it',
      { maxSteps: 2, memory: { thread: 'p-1', resource: 'u' } },
    );
    expect(toolErrors(pinned)).toEqual([]);
    const pin = (
      await knowledge
        .getStorage()
        .then(store => store.search({ query: 'French', scope: ['resource:u', 'team:acme:x'], limit: 5 }))
    )[0];
    expect(pin?.text).toBe('Always answer in French.');
    expect(JSON.stringify(prompts[0])).not.toContain('Always answer in French.');
    // No pins at step 0, so the first emission after pinning is a snapshot.
    expect(JSON.stringify(prompts[1])).toContain('<pinned-knowledge');
    expect(JSON.stringify(prompts[1])).toContain('Always answer in French.');

    prompts.length = 0;
    await agent([]).generate('hello', { memory: { thread: 'p-2', resource: 'u' } });
    expect(JSON.stringify(prompts[0])).toContain('<pinned-knowledge');
    expect(JSON.stringify(prompts[0])).toContain('Always answer in French.');

    const other = new Agent({
      id: 'other',
      name: 'other',
      instructions: 'x',
      model: scriptedModel([], prompts),
      knowledge,
      scopes: ['team:acme:y'],
    });
    prompts.length = 0;
    await other.generate('hello', { memory: { thread: 'p-3', resource: 'v' } });
    expect(JSON.stringify(prompts[0])).not.toContain('Always answer in French.');
  });
});
