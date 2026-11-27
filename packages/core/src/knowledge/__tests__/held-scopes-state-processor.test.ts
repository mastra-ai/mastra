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
  it('snapshots every held scope on the first turn, scopes with no pages included', async () => {
    const { requestContext, processor, args } = harness();
    setRunAgentScopes(requestContext, ['org:acme', 'agent:support', 'docs:acme']);

    const snapshot = (await processor.computeStateSignal(args())) as any;
    expect(snapshot).toMatchObject({ mode: 'snapshot', tagName: 'knowledge-scopes', attributes: { count: 5 } });
    expect(snapshot.value.scopes).toEqual([
      { address: 'org:acme', role: 'editor', can: 'write' },
      { address: 'agent:support', can: 'none' },
      { address: 'docs:acme', role: 'viewer', can: 'read' },
      { address: 'resource:user-1', role: 'owner', can: 'write' },
      { address: 'thread:t-1', role: 'owner', can: 'write' },
    ]);
    expect(snapshot.contents).toContain('org:acme: write (editor)');
    expect(snapshot.contents).toContain('docs:acme: read (viewer)');
    expect(snapshot.contents).toContain('agent:support: none');
    expect(snapshot.contents).toContain('thread:t-1: write (owner)');
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

  it('sends a delta when a scope is added, removed, or its permission changes', async () => {
    const { requestContext, processor, args, asBase } = harness();
    setRunAgentScopes(requestContext, ['org:acme']);
    const snapshot = (await processor.computeStateSignal(args())) as any;
    const base = { lastSnapshot: asBase(snapshot), contextWindow: { hasSnapshot: true } };

    setRunAgentScopes(requestContext, ['org:acme', 'docs:acme']);
    const added = (await processor.computeStateSignal(args(base))) as any;
    expect(added).toMatchObject({ mode: 'delta', tagName: 'knowledge-scopes-update', attributes: { changes: 1 } });
    expect(added.delta.ops).toEqual([{ op: 'add', scope: { address: 'docs:acme', role: 'viewer', can: 'read' } }]);
    expect(added.contents).toContain('+ docs:acme: read (viewer)');

    // Dropping org:acme removes it, and takes away the viewer role docs:acme granted through it.
    setRunAgentScopes(requestContext, ['docs:acme']);
    const changed = (await processor.computeStateSignal(
      args({ ...base, deltasSinceSnapshot: [{ metadata: added.metadata }] }),
    )) as any;
    expect(changed.mode).toBe('delta');
    expect(changed.delta.ops).toEqual([
      { op: 'remove', address: 'org:acme' },
      { op: 'change', scope: { address: 'docs:acme', can: 'none' } },
    ]);
    expect(changed.contents).toContain('- removed org:acme');
    expect(changed.contents).toContain('~ changed docs:acme: none');
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
  });
});
