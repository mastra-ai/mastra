import { describe, expect, it } from 'vitest';
import { setRunAgentScopes } from '../../agent/scopes';
import { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage';
import { knowledgeMemoryScopes } from '../declarations';
import { HeldScopesStateProcessor } from '../held-scopes-state-processor';
import { Knowledge } from '../index';

// r479: #31308 lets a model list its held scopes with a tool call, but nothing told it about them up
// front, so on a first turn it still had to call a tool to learn where it may read or write.
function harness() {
  const knowledge = new Knowledge({
    storage: new InMemoryStore({ id: 'held-scopes-state' }),
    tools: true,
    scopes: {
      ...knowledgeMemoryScopes(),
      'agent:$agentId': { access: [] },
      'docs:$orgId': { belongsTo: 'org:$orgId', access: [{ principal: 'org:$orgId', role: 'viewer' }] },
    },
  });
  const requestContext = new RequestContext();
  const processor = new HeldScopesStateProcessor({
    principalsKey: context => knowledge.__principalsKey(context),
    readHeldScopes: context => knowledge.__heldScopes(context),
  });
  const args = (overrides: Record<string, unknown> = {}) =>
    ({
      threadId: 't-1',
      resourceId: 'user-1',
      stepNumber: 0,
      requestContext,
      contextWindow: { hasSnapshot: false },
      lastSnapshot: undefined,
      deltasSinceSnapshot: [],
      ...overrides,
    }) as any;
  const asBase = (signal: any) => ({ metadata: signal.metadata });
  return { knowledge, requestContext, processor, args, asBase };
}

describe('HeldScopesStateProcessor', () => {
  it('snapshots every scope it holds a role on, scopes with no pages included', async () => {
    const { requestContext, processor, args } = harness();
    // agent:support grants this run no role, so it gives no access and is left out.
    setRunAgentScopes(requestContext, ['org:acme', 'agent:support', 'docs:acme']);

    const snapshot = (await processor.computeStateSignal(args())) as any;
    expect(snapshot).toMatchObject({ mode: 'snapshot', tagName: 'knowledge-scopes' });
    expect(snapshot.attributes).toBeUndefined();
    expect(snapshot.value.scopes).toEqual([
      { address: 'org:acme', role: 'editor' },
      { address: 'docs:acme', role: 'viewer' },
      { address: 'resource:user-1', role: 'owner' },
      { address: 'thread:t-1', role: 'owner' },
    ]);
    expect(snapshot.contents).toBe(
      [
        '',
        '  Your session has access to:',
        '  - org:acme (editor)',
        '  - docs:acme (viewer)',
        '  - resource:user-1 (owner)',
        '  - thread:t-1 (owner)',
        '',
      ].join('\n'),
    );
  });

  it('lists held scopes only, not scopes a held role reaches, and says so', async () => {
    const { knowledge, requestContext, processor, args } = harness();
    // org:acme grants viewer on docs:acme, but the run does not hold docs:acme, so it is not listed.
    await knowledge.upsertPage({ scope: 'docs:acme', path: 'guide', name: 'Guide', body: 'reachable guide' });
    const tools = knowledge.createTools({ read: true, principals: ['org:acme'] }) as any;
    const read = await tools.knowledge_read.execute({ page: 'docs:acme#guide' }, {});
    expect(JSON.stringify(read)).toContain('reachable guide');

    setRunAgentScopes(requestContext, ['org:acme']);
    const snapshot = (await processor.computeStateSignal(args())) as any;
    expect(snapshot.value.scopes.map((scope: { address: string }) => scope.address)).not.toContain('docs:acme');
    const result = processor.processInput({ messages: [], systemMessages: [] } as any) as any;
    expect(result.systemMessages.at(-1).content).toContain(
      'The list names the scopes your session holds, not every scope you can reach',
    );
  });

  it('emits nothing while the held scopes are unchanged and the snapshot is visible', async () => {
    const { requestContext, processor, args, asBase } = harness();
    setRunAgentScopes(requestContext, ['org:acme']);
    const snapshot = await processor.computeStateSignal(args());
    const next = await processor.computeStateSignal(
      args({ lastSnapshot: asBase(snapshot), contextWindow: { hasSnapshot: true } }),
    );
    expect(next).toBeUndefined();
  });

  it('a write that creates a held scope page changes nothing the signal shows', async () => {
    const { knowledge, requestContext, processor, args, asBase } = harness();
    setRunAgentScopes(requestContext, ['org:acme']);
    const snapshot = await processor.computeStateSignal(args());
    await knowledge.upsertPage({ scope: 'org:acme', path: 'tone', name: 'Tone', body: 'Answer in French.' });
    const next = await processor.computeStateSignal(
      args({ lastSnapshot: asBase(snapshot), contextWindow: { hasSnapshot: true } }),
    );
    expect(next).toBeUndefined();
  });

  it('sends a delta when a scope is added, removed, or its role changes', async () => {
    const { requestContext, processor, args, asBase } = harness();
    setRunAgentScopes(requestContext, ['org:acme']);
    const snapshot = (await processor.computeStateSignal(args())) as any;
    const base = { lastSnapshot: asBase(snapshot), contextWindow: { hasSnapshot: true } };

    setRunAgentScopes(requestContext, ['org:acme', 'docs:acme']);
    const added = (await processor.computeStateSignal(args(base))) as any;
    expect(added).toMatchObject({ mode: 'delta', tagName: 'knowledge-scopes-update' });
    expect(added.attributes).toBeUndefined();
    expect(added.delta.ops).toEqual([{ op: 'add', scope: { address: 'docs:acme', role: 'viewer' } }]);
    expect(added.contents).toBe('\n  + docs:acme (viewer)\n');

    // Dropping org:acme removes it, and takes away the viewer role docs:acme granted through it:
    // losing a role reads as losing access.
    setRunAgentScopes(requestContext, ['docs:acme']);
    const folded = { ...base, deltasSinceSnapshot: [{ metadata: added.metadata }] };
    const removed = (await processor.computeStateSignal(args(folded))) as any;
    expect(removed.mode).toBe('delta');
    expect(removed.delta.ops).toEqual([
      { op: 'remove', address: 'org:acme' },
      { op: 'remove', address: 'docs:acme' },
    ]);
    expect(removed.contents).toBe(
      '\n  - org:acme was removed from your scopes\n  - docs:acme was removed from your scopes\n',
    );
  });

  it('sends a role change as a change, not a removal', async () => {
    const { requestContext, processor, args } = harness();
    setRunAgentScopes(requestContext, ['org:acme']);
    // A snapshot from a turn where the run was a viewer on org:acme; it is an editor now.
    const base = {
      lastSnapshot: { metadata: { value: { scopes: [{ address: 'org:acme', role: 'viewer' }] } } },
      contextWindow: { hasSnapshot: true },
    };
    const changed = (await processor.computeStateSignal(args(base))) as any;
    expect(changed.delta.ops).toContainEqual({ op: 'change', scope: { address: 'org:acme', role: 'editor' } });
    expect(changed.contents).toContain('  ~ org:acme role changed to editor');
  });

  it('clears the list with a snapshot that says so when no scope is held any more', async () => {
    const { args } = harness();
    const processorWithNone = new HeldScopesStateProcessor({
      principalsKey: () => 'k',
      readHeldScopes: async () => [],
    });
    const base = {
      lastSnapshot: { metadata: { value: { scopes: [{ address: 'org:acme', role: 'viewer' }] } } },
      contextWindow: { hasSnapshot: true },
    };
    const cleared = (await processorWithNone.computeStateSignal(args(base))) as any;
    expect(cleared).toMatchObject({ mode: 'snapshot', contents: '\n  Your session holds no Knowledge scopes.\n' });
    expect(await processorWithNone.computeStateSignal(args())).toBeUndefined();
    const leftWindow = { lastSnapshot: base.lastSnapshot, contextWindow: { hasSnapshot: false } };
    expect(await processorWithNone.computeStateSignal(args(leftWindow))).toBeUndefined();
  });

  it('sends a full snapshot again once the earlier one has left the context window', async () => {
    const { requestContext, processor, args, asBase } = harness();
    setRunAgentScopes(requestContext, ['org:acme']);
    const snapshot = await processor.computeStateSignal(args());
    const again = await processor.computeStateSignal(
      args({ lastSnapshot: asBase(snapshot), contextWindow: { hasSnapshot: false } }),
    );
    expect(again).toMatchObject({ mode: 'snapshot' });
  });

  it('fails the turn when the held scopes cannot be read, rather than sending none', async () => {
    const { knowledge, requestContext, processor, args } = harness();
    setRunAgentScopes(requestContext, ['org:acme']);
    const store = await knowledge.getStorage();
    store.getScopesByAddress = async () => {
      throw new Error('knowledge store down');
    };
    await expect(processor.computeStateSignal(args())).rejects.toThrow('knowledge store down');
  });

  it('tells the model how to read the scope signal', () => {
    const { processor } = harness();
    const result = processor.processInput({ messages: [], systemMessages: [] } as any) as any;
    const preamble = result.systemMessages.at(-1).content as string;
    expect(preamble).toContain('<knowledge-scopes');
    expect(preamble).toContain('<knowledge-scopes-update');
    expect(preamble).toContain('no pages yet');
    expect(preamble).toContain('Viewers can only read; every other role can also write.');
    expect(preamble).toContain('not every scope you can reach');
  });
});
