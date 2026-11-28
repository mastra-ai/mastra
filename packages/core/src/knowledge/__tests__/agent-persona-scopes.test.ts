import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { Agent } from '../../agent';
import { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage';
import { KnowledgeDeclarationError, compileKnowledgeScopes, knowledgeMemoryScopes } from '../declarations';
import type { KnowledgeScopeDeclarations } from '../declarations';
import { Knowledge, knowledgeAgentScopes } from '../index';

type Call = { toolName: string; input: unknown } | { text: string };

function scriptedModel(calls: Call[]) {
  let step = 0;
  return new MockLanguageModelV2({
    doGenerate: async () => {
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

type RunResult = Awaited<ReturnType<Agent['generate']>>;

function toolOutputs(result: RunResult): Array<{ error?: string; result?: any }> {
  return result.steps.flatMap(step =>
    step.content.flatMap((part: any) => {
      if (part.type !== 'tool-result') return [];
      if (part.output?.type === 'error-text') return [{ error: String(part.output.value) }];
      return [{ result: part.output?.value ?? part.output }];
    }),
  );
}

function heldAddresses(result: RunResult): string[] {
  const read = toolOutputs(result)[0]!;
  if (read.error) throw new Error(read.error);
  return (read.result.scopes as Array<{ address: string }>).map(scope => scope.address).sort();
}

const memoryRun = { memory: { resource: 'slack:U123', thread: 'thread-1' } };

function agentWith(
  knowledge: Knowledge,
  options: { id: string; metadata?: ConstructorParameters<typeof Agent>[0]['metadata']; calls: Call[] },
) {
  return new Agent({
    id: options.id,
    name: options.id,
    instructions: 'x',
    model: scriptedModel(options.calls),
    knowledge,
    scopes: ['org:org_2x9'],
    ...(options.metadata ? { metadata: options.metadata } : {}),
  });
}

const allIdentities = [
  'agent:a1b2',
  'agent:a1b2:org:org_2x9',
  'agent:a1b2:user:slack%3AU123',
  'agent:persona:role:support',
  'agent:persona:role:support:org:org_2x9',
  'agent:persona:role:support:user:slack%3AU123',
  'agent:persona:team:billing',
];

describe('knowledgeAgentScopes() minting', () => {
  const knowledgeWith = (scopes: KnowledgeScopeDeclarations) =>
    new Knowledge({ storage: new InMemoryStore({ id: 'mint' }), tools: true, scopes });

  it('mints the agent, role and team identities from Agent.id and metadata.persona', async () => {
    const knowledge = knowledgeWith({ ...knowledgeMemoryScopes(), ...knowledgeAgentScopes() });
    const agent = agentWith(knowledge, {
      id: 'a1b2',
      metadata: { persona: { name: 'Sam', role: 'support', teamId: 'billing' } },
      calls: [{ toolName: 'knowledge_read', input: {} }],
    });
    const held = heldAddresses(await agent.generate('who am I', { maxSteps: 2, ...memoryRun }));
    expect(held).toEqual([...allIdentities, 'org:org_2x9', 'resource:slack%3AU123', 'thread:thread-1'].sort());
  });

  it('mints nothing from an unflagged agent declaration', async () => {
    const knowledge = knowledgeWith({ ...knowledgeMemoryScopes(), 'agent:$agentId': { access: [] } });
    const agent = agentWith(knowledge, {
      id: 'a1b2',
      metadata: { persona: { role: 'support' } },
      calls: [{ toolName: 'knowledge_read', input: {} }],
    });
    const held = heldAddresses(await agent.generate('who am I', { maxSteps: 2, ...memoryRun }));
    expect(held).toEqual(['org:org_2x9', 'resource:slack%3AU123', 'thread:thread-1']);
  });

  it.each([
    ['no persona', undefined],
    ['an empty role and team', { persona: { role: '', teamId: '' } }],
    ['a non-string role and team', { persona: { role: 7, teamId: { id: 'billing' } } }],
    ['a non-object persona', { persona: 'support' }],
  ])('skips role and team quietly with %s; the agent forms still mint', async (_label, metadata) => {
    const knowledge = knowledgeWith({ ...knowledgeMemoryScopes(), ...knowledgeAgentScopes() });
    const agent = agentWith(knowledge, {
      id: 'a1b2',
      ...(metadata ? { metadata: metadata as never } : {}),
      calls: [{ toolName: 'knowledge_read', input: {} }],
    });
    const held = heldAddresses(await agent.generate('who am I', { maxSteps: 2, ...memoryRun }));
    expect(held.filter(address => address.startsWith('agent:'))).toEqual([
      'agent:a1b2',
      'agent:a1b2:org:org_2x9',
      'agent:a1b2:user:slack%3AU123',
    ]);
  });

  it('mints no user forms without a Memory resource, and no org forms without an org: run scope', async () => {
    const knowledge = knowledgeWith({ ...knowledgeMemoryScopes(), ...knowledgeAgentScopes(), 'kb:$kbId': {} });
    const agent = new Agent({
      id: 'a1b2',
      name: 'a1b2',
      instructions: 'x',
      model: scriptedModel([{ toolName: 'knowledge_read', input: {} }]),
      knowledge,
      scopes: ['kb:docs'],
      metadata: { persona: { role: 'support' } },
    });
    const held = heldAddresses(await agent.generate('who am I', { maxSteps: 2 }));
    expect(held).toEqual(['agent:a1b2', 'agent:persona:role:support', 'kb:docs']);
  });

  it('keeps $agentId the Agent id when a role is set, and authors writes by the Agent id', async () => {
    const knowledge = knowledgeWith({
      ...knowledgeMemoryScopes(),
      ...knowledgeAgentScopes(),
      'kb:$kbId': { access: [{ principal: 'agent:persona:role:support', role: 'editor' }] },
    });
    const agent = agentWith(knowledge, {
      id: 'a1b2',
      metadata: { persona: { role: 'support' } },
      calls: [{ toolName: 'knowledge_page', input: { op: 'write', scope: 'kb:docs', name: 'Refunds', body: 'Ask.' } }],
    });
    const [written] = toolOutputs(await agent.generate('write', { maxSteps: 2, ...memoryRun }));
    expect(written!.error).toBeUndefined();
    const store = await knowledge.getStorage();
    const page = await store.getPage({
      id: written!.result.page.id,
      read: await knowledge.readScopeFor(['agent:persona:role:support']),
    });
    expect(page?.createdBy.author).toBe('agent:a1b2');
  });

  it('reads the persona from function-form metadata for the run request context', async () => {
    const knowledge = knowledgeWith({ ...knowledgeMemoryScopes(), ...knowledgeAgentScopes() });
    const agent = agentWith(knowledge, {
      id: 'a1b2',
      metadata: ({ requestContext }) => ({ persona: { role: String(requestContext.get('desk')) } }),
      calls: [{ toolName: 'knowledge_read', input: {} }],
    });
    const requestContext = new RequestContext([['desk', 'billing']]);
    const held = heldAddresses(await agent.generate('who am I', { maxSteps: 2, requestContext, ...memoryRun }));
    expect(held).toContain('agent:persona:role:billing');
    expect(held).not.toContain('agent:persona:role:support');
  });

  it('lets two agents with one role share role grants, but not each other’s agent grants', async () => {
    const knowledge = knowledgeWith({
      ...knowledgeMemoryScopes(),
      ...knowledgeAgentScopes(),
      'kb:$kbId': {
        access: [
          { principal: 'agent:persona:role:support', role: 'viewer' },
          { principal: 'agent:writer', role: 'editor' },
        ],
      },
    });
    const write = agentWith(knowledge, {
      id: 'writer',
      calls: [{ toolName: 'knowledge_page', input: { op: 'write', scope: 'kb:docs', name: 'Refunds', body: 'R' } }],
    });
    const [written] = toolOutputs(await write.generate('write', { maxSteps: 2, ...memoryRun }));
    expect(written!.error).toBeUndefined();

    const reads = async (
      id: string,
      role?: string,
      calls: Call[] = [{ toolName: 'knowledge_read', input: { page: written!.result.page.id } }],
    ) =>
      toolOutputs(
        await agentWith(knowledge, { id, ...(role ? { metadata: { persona: { role } } } : {}), calls }).generate(
          'read',
          {
            maxSteps: 2,
            ...memoryRun,
          },
        ),
      )[0]!;
    expect((await reads('s1', 'support')).error).toBeUndefined();
    expect((await reads('s2', 'support')).error).toBeUndefined();
    expect((await reads('b1', 'billing')).error).toMatch(/not found/);
    expect((await reads('persona')).error).toMatch(/not found/);
    // A support agent reads but can't write what the role may only view, unlike agent:writer.
    const edit = await reads('s1', 'support', [
      { toolName: 'knowledge_page', input: { op: 'write', page: written!.result.page.id, body: 'changed' } },
    ]);
    expect(edit.error).toMatch(/needs/);
  });

  it('reaches a user’s area only through the role-for-user form for the user it is serving', async () => {
    const knowledge = knowledgeWith({
      ...knowledgeMemoryScopes(),
      ...knowledgeAgentScopes(),
      'customer:$resourceId': {
        access: [{ principal: 'agent:persona:role:support:user:$resourceId', role: 'editor' }],
      },
    });
    const writeFor = async (id: string, role: string, resource: string, customer: string) =>
      toolOutputs(
        await agentWith(knowledge, {
          id,
          metadata: { persona: { role } },
          calls: [{ toolName: 'knowledge_page', input: { op: 'write', scope: customer, name: 'Notes', body: 'n' } }],
        }).generate('write', { maxSteps: 2, memory: { resource, thread: `${id}-${resource}` } }),
      )[0]!;
    expect((await writeFor('s1', 'support', 'slack:U123', 'customer:slack%3AU123')).error).toBeUndefined();
    expect((await writeFor('s2', 'support', 'slack:U123', 'customer:slack%3AU123')).error).toBeUndefined();
    expect((await writeFor('s1', 'support', 'slack:V9', 'customer:slack%3AU123')).error).toBeDefined();
    expect((await writeFor('b1', 'billing', 'slack:U123', 'customer:slack%3AU123')).error).toBeDefined();
  });

  it('mints a sub-agent only its own identities, never its parent’s', async () => {
    const knowledge = knowledgeWith({ ...knowledgeMemoryScopes(), ...knowledgeAgentScopes() });
    const helper = new Agent({
      id: 'helper',
      name: 'helper',
      description: 'Helps.',
      instructions: 'x',
      model: scriptedModel([{ toolName: 'knowledge_read', input: {} }]),
      knowledge,
      metadata: { persona: { role: 'support' } },
    });
    const parent = new Agent({
      id: 'lead',
      name: 'lead',
      instructions: 'x',
      model: scriptedModel([{ toolName: 'agent-helper', input: { prompt: 'who are you' } }]),
      knowledge,
      scopes: ['org:org_2x9'],
      metadata: { persona: { role: 'lead', teamId: 'billing' } },
      agents: { helper },
    });
    const result = await parent.generate('delegate', { maxSteps: 2, ...memoryRun });
    const delegated = JSON.stringify(toolOutputs(result));
    expect(delegated).toContain('agent:helper');
    expect(delegated).toContain('agent:persona:role:support');
    expect(delegated).not.toContain('agent:lead');
    expect(delegated).not.toContain('agent:persona:role:lead');
    expect(delegated).not.toContain('agent:persona:team:billing');
  });

  it('still needs run scopes or Memory: agent identities alone never make Knowledge usable', async () => {
    const knowledge = knowledgeWith({ ...knowledgeMemoryScopes(), ...knowledgeAgentScopes() });
    const agent = new Agent({
      id: 'a1b2',
      name: 'a1b2',
      instructions: 'x',
      model: scriptedModel([{ toolName: 'knowledge_read', input: {} }]),
      knowledge,
      metadata: { persona: { role: 'support' } },
    });
    const [read] = toolOutputs(await agent.generate('who am I', { maxSteps: 2 }));
    expect(read!.error).toMatch(/need run scopes/);
  });
});

describe('flagged declarations', () => {
  it('refuses an unknown mint value', () => {
    expect(() => compileKnowledgeScopes({ 'agent:$agentId': { mint: 'always' as never } })).toThrow(
      KnowledgeDeclarationError,
    );
  });

  it('refuses a param outside the run identity set', () => {
    expect(() => compileKnowledgeScopes({ 'agent:$agentId:desk:$deskId': { mint: 'run-identity' } })).toThrow(
      /\$deskId/,
    );
  });

  it('refuses a flagged declaration that is not of type agent, or names no param', () => {
    expect(() => compileKnowledgeScopes({ 'org:$orgId': { mint: 'run-identity' } })).toThrow(KnowledgeDeclarationError);
    expect(() => compileKnowledgeScopes({ 'agent:$agentId': {}, 'agent:fixed': { mint: 'run-identity' } })).toThrow(
      KnowledgeDeclarationError,
    );
  });

  it('compiles the preset with no overlap, and an agent with id "persona" takes no role or team address', () => {
    const compiled = compileKnowledgeScopes({ ...knowledgeMemoryScopes(), ...knowledgeAgentScopes() });
    expect(compiled.match('agent:persona')?.declaration).toBe('agent:$agentId');
    expect(compiled.match('agent:persona:role:support')?.declaration).toBe('agent:persona:role:$role');
    expect(compiled.match('agent:persona:team:billing')?.declaration).toBe('agent:persona:team:$teamId');
    expect(compiled.match('agent:persona:org:org_2x9')?.declaration).toBe('agent:$agentId:org:$orgId');
  });
});
