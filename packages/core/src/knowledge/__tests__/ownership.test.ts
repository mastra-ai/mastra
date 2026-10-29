import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { Agent } from '../../agent';
import { InMemoryStore } from '../../storage';
import { Knowledge } from '../index';

type Call = { toolName: string; input: unknown };

function scriptedModel(calls: Call[]) {
  let step = 0;
  return new MockLanguageModelV2({
    doGenerate: async () => {
      const call = calls[step++];
      const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
      if (!call) {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop' as const,
          usage,
          content: [{ type: 'text' as const, text: 'Done.' }],
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

function toolErrors(result: Awaited<ReturnType<Agent['generate']>>): string[] {
  return result.steps.flatMap(step =>
    step.content.flatMap((part: any) =>
      part.type === 'tool-result' && part.output?.type === 'error-text' ? [String(part.output.value)] : [],
    ),
  );
}

function toolResults(result: Awaited<ReturnType<Agent['generate']>>): any[] {
  return result.steps.flatMap(step =>
    step.content.flatMap((part: any) =>
      part.type === 'tool-result' && part.output?.type !== 'error-text' ? [part.output?.value ?? part.output] : [],
    ),
  );
}

function companyKnowledge(id: string, role: 'owner' | 'edit' | 'append' | 'readonly' = 'owner') {
  return new Knowledge({
    storage: new InMemoryStore({ id }),
    tools: true,
    scopes: {
      'team:$orgId:$teamId': { access: [{ principal: 'org:$orgId', role }] },
    },
  });
}

// Plain tags here are held writable; read-only cases name `{ scope, access: 'read' }`.
const writable = (scopes: any[]) => scopes.map(s => (typeof s === 'string' ? { scope: s, access: 'write' } : s));

async function run(knowledge: Knowledge, scopes: any[], calls: Call[], thread = 't-1') {
  const agent = new Agent({
    id: 'a',
    name: 'a',
    instructions: 'x',
    model: scriptedModel(calls),
    knowledge,
    scopes: writable(scopes),
  });
  return agent.generate('go', { maxSteps: calls.length + 1, memory: { thread, resource: 'r' } });
}

describe('Knowledge ownership computed from the structure', () => {
  it('lets a run holding org:acme write and read team:acme:* by naming it, and refuses other orgs', async () => {
    const knowledge = companyKnowledge('own-basic');

    const wrote = await run(
      knowledge,
      ['org:acme'],
      [
        {
          toolName: 'knowledge_record',
          input: { op: 'add', node: 'Plan', kind: 'doc', text: 'ship it', scope: ['team:acme:lead'] },
        },
        {
          toolName: 'knowledge_record',
          input: { op: 'add', node: 'Theirs', kind: 'doc', text: 'x', scope: ['team:other:lead'] },
        },
      ],
    );
    expect(toolResults(wrote)[0].record.scope).toEqual(['team:acme:lead']);
    expect(toolErrors(wrote)).toEqual(['This run does not hold scope "team:other:lead".']);

    const unnamed = await run(knowledge, ['org:acme'], [{ toolName: 'knowledge_search', input: { query: 'ship' } }]);
    expect(toolResults(unnamed)[0].results).toEqual([]);

    const named = await run(
      knowledge,
      ['org:acme'],
      [{ toolName: 'knowledge_search', input: { query: 'ship', scope: ['team:acme:lead'] } }],
    );
    expect(toolResults(named)[0].results.map((hit: any) => hit.text)).toContain('ship it');
  });

  it("shows a member team write to the lead through ownership, but not the member's private default write", async () => {
    const knowledge = companyKnowledge('own-lead');
    await run(
      knowledge,
      [{ scope: 'org:acme', access: 'read' }, 'team:acme:x', 'agent:alex'],
      [
        {
          toolName: 'knowledge_record',
          input: { op: 'add', node: 'Team fact', kind: 'doc', text: 'shared fact', scope: ['team:acme:x'] },
        },
        { toolName: 'knowledge_record', input: { op: 'add', node: 'Private fact', kind: 'doc', text: 'private fact' } },
      ],
      'member-thread',
    );

    const lead = await run(
      knowledge,
      ['org:acme', 'team:acme:lead'],
      [{ toolName: 'knowledge_search', input: { query: 'fact', scope: ['team:acme:x'] } }],
    );
    const texts = toolResults(lead)[0].results.map((hit: any) => hit.text);
    expect(texts).toContain('shared fact');
    expect(texts).not.toContain('private fact');
  });

  it('never treats a read-only owner tag as an ownership principal', async () => {
    const knowledge = companyKnowledge('own-readonly-principal');
    await run(
      knowledge,
      ['org:acme'],
      [
        {
          toolName: 'knowledge_record',
          input: { op: 'add', node: 'Other team', kind: 'doc', text: 'secret', scope: ['team:acme:other'] },
        },
      ],
    );

    const member = await run(
      knowledge,
      [{ scope: 'org:acme', access: 'read' }, 'team:acme:x'],
      [
        { toolName: 'knowledge_search', input: { query: 'secret', scope: ['team:acme:other'] } },
        {
          toolName: 'knowledge_record',
          input: { op: 'add', node: 'Sneak', kind: 'doc', text: 'x', scope: ['team:acme:other'] },
        },
      ],
    );
    expect(toolErrors(member)).toEqual([
      'This run does not hold scope "team:acme:other".',
      'This run does not hold scope "team:acme:other".',
    ]);
  });

  it('applies the declared role: readonly reads but cannot write; edit can rescope', async () => {
    const readonly = companyKnowledge('own-role-readonly', 'readonly');
    const refused = await run(
      readonly,
      ['org:acme'],
      [
        { toolName: 'knowledge_search', input: { query: 'x', scope: ['team:acme:p'] } },
        {
          toolName: 'knowledge_record',
          input: { op: 'add', node: 'N', kind: 'doc', text: 'x', scope: ['team:acme:p'] },
        },
      ],
    );
    expect(toolResults(refused)[0].results).toEqual([]);
    expect(toolErrors(refused)).toEqual(['This run reaches "team:acme:p" with role readonly; this needs append.']);

    const append = companyKnowledge('own-role-append', 'append');
    const created = await run(
      append,
      ['org:acme'],
      [
        {
          toolName: 'knowledge_record',
          input: { op: 'add', node: 'N', kind: 'doc', text: 'x', scope: ['team:acme:p'] },
        },
      ],
    );
    const recordId = toolResults(created)[0].record.id;
    const noEdit = await run(
      append,
      ['org:acme'],
      [{ toolName: 'knowledge_record', input: { op: 'rescope', recordId, scope: ['org:acme'] } }],
    );
    expect(toolErrors(noEdit)).toEqual(['This run reaches "team:acme:p" with role append; this needs edit.']);

    const edit = companyKnowledge('own-role-edit', 'edit');
    const createdEdit = await run(
      edit,
      ['org:acme'],
      [
        {
          toolName: 'knowledge_record',
          input: { op: 'add', node: 'N', kind: 'doc', text: 'x', scope: ['team:acme:p'] },
        },
      ],
    );
    const rescoped = await run(
      edit,
      ['org:acme'],
      [
        {
          toolName: 'knowledge_record',
          input: { op: 'rescope', recordId: toolResults(createdEdit)[0].record.id, scope: ['org:acme'] },
        },
      ],
    );
    expect(toolErrors(rescoped)).toEqual([]);
  });

  it('never reaches an undeclared tag type through ownership', async () => {
    const knowledge = companyKnowledge('own-undeclared');
    const result = await run(
      knowledge,
      ['org:acme'],
      [
        {
          toolName: 'knowledge_record',
          input: { op: 'add', node: 'N', kind: 'doc', text: 'x', scope: ['request:r25'] },
        },
      ],
    );
    expect(toolErrors(result)).toEqual(['This run does not hold scope "request:r25".']);
  });

  it('grants nothing through unbound $param, self, parent or mirror principals', async () => {
    const knowledge = new Knowledge({
      storage: new InMemoryStore({ id: 'own-ignored-principals' }),
      tools: true,
      scopes: {
        'team:$orgId:$teamId': {
          access: [
            { principal: 'org:$tenantId', role: 'owner' },
            { principal: 'self', role: 'owner' },
            { principal: 'parent', role: 'mirror' },
          ],
        },
      },
    });
    const result = await run(
      knowledge,
      ['org:acme', 'org:xtenantId'],
      [
        {
          toolName: 'knowledge_record',
          input: { op: 'add', node: 'N', kind: 'doc', text: 'x', scope: ['team:acme:x'] },
        },
      ],
    );
    expect(toolErrors(result)).toEqual(['This run does not hold scope "team:acme:x".']);
  });

  it('uses the strongest role across principals and names held and needed roles when short', async () => {
    const knowledge = new Knowledge({
      storage: new InMemoryStore({ id: 'own-strongest' }),
      tools: true,
      scopes: {
        'team:$orgId:$teamId': {
          access: [
            { principal: 'org:$orgId', role: 'readonly' },
            { principal: 'admin:$orgId', role: 'append' },
          ],
        },
      },
    });
    const created = await run(
      knowledge,
      ['org:acme', 'admin:acme'],
      [
        {
          toolName: 'knowledge_record',
          input: { op: 'add', node: 'N', kind: 'doc', text: 'x', scope: ['team:acme:x'] },
        },
      ],
    );
    expect(toolErrors(created)).toEqual([]);
    const removed = await run(
      knowledge,
      ['org:acme', 'admin:acme'],
      [{ toolName: 'knowledge_record', input: { op: 'remove', recordId: toolResults(created)[0].record.id } }],
    );
    expect(toolErrors(removed)).toEqual(['This run reaches "team:acme:x" with role append; this needs edit.']);
  });

  it('refuses a target with one owned and one unowned tag for write and remove', async () => {
    const knowledge = companyKnowledge('own-mixed');
    const seeded = await run(
      knowledge,
      ['org:acme', 'project:p'],
      [
        {
          toolName: 'knowledge_record',
          input: { op: 'add', node: 'Mixed', kind: 'doc', text: 'x', scope: ['team:acme:x', 'project:p'] },
        },
      ],
    );
    const recordId = toolResults(seeded)[0].record.id;

    const outsider = await run(
      knowledge,
      ['org:acme'],
      [
        {
          toolName: 'knowledge_record',
          input: { op: 'add', node: 'M2', kind: 'doc', text: 'y', scope: ['team:acme:x', 'project:p'] },
        },
        { toolName: 'knowledge_record', input: { op: 'remove', recordId } },
      ],
    );
    expect(toolErrors(outsider)).toEqual([
      'This run does not hold scope "project:p".',
      "KnowledgeRecord is outside this run's visible scope.",
    ]);
  });

  it('refuses a write whose run tags plus named scope exceed the 8-tag cap, naming the cap', async () => {
    const knowledge = companyKnowledge('own-cap');
    // org:acme + seven more held tags + resource:/thread: from Memory = 10 tags.
    const held = ['org:acme', ...Array.from({ length: 7 }, (_, index) => `agent:a${index}`)];
    const result = await run(knowledge, held, [
      { toolName: 'knowledge_record', input: { op: 'add', node: 'Too wide', kind: 'doc', text: 'x' } },
      { toolName: 'knowledge_search', input: { query: 'x', scope: ['team:acme:support'] } },
    ]);
    const errors = toolErrors(result);
    expect(errors).toHaveLength(2);
    for (const error of errors) expect(error).toContain('at most 8 tags');
    expect((await knowledge.listKnowledgeAbout({ node: 'Too wide', scope: held.slice(0, 8) })).records).toEqual([]);
  });

  it("needs edit to overwrite an existing node's content, append to create one", async () => {
    const knowledge = companyKnowledge('own-content', 'append');
    const created = await run(
      knowledge,
      ['org:acme'],
      [{ toolName: 'knowledge_node', input: { op: 'write', name: 'Doc', content: 'v1', scope: ['team:acme:x'] } }],
    );
    expect(toolErrors(created)).toEqual([]);
    const overwrite = await run(
      knowledge,
      ['org:acme'],
      [
        {
          toolName: 'knowledge_node',
          input: {
            op: 'update',
            node: toolResults(created)[0].id,
            content: 'v2',
            expectedVersion: toolResults(created)[0].version,
          },
        },
      ],
    );
    expect(toolErrors(overwrite)).toEqual(['This run reaches "team:acme:x" with role append; this needs edit.']);
  });
});
