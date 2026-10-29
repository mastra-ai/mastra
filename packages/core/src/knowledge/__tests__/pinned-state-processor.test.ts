import { describe, expect, it } from 'vitest';
import { setRunAgentScopes } from '../../agent/scopes';
import { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage';
import { knowledgeMemoryScopes } from '../declarations';
import { Knowledge } from '../index';
import { PinnedStateProcessor } from '../pinned-state-processor';

describe('PinnedStateProcessor', () => {
  function harness() {
    const knowledge = new Knowledge({
      storage: new InMemoryStore({ id: 'pinned-state-processor' }),
      scopes: {
        ...knowledgeMemoryScopes(),
        'policy:$orgId': {
          access: [{ principal: 'org:$orgId', role: 'editor' }],
          pages: [{ key: 'tone', name: 'Tone' }],
        },
      },
      tools: true,
      pinnedContext: true,
    });
    const tools = knowledge.createTools();
    const requestContext = new RequestContext();
    setRunAgentScopes(requestContext, ['org:acme']);
    const context = { requestContext, agent: { agentId: 'a', resourceId: 'user-42', threadId: 'alpha' } };
    const call = (tool: string, input: Record<string, unknown>) =>
      tools[tool]!.execute!(input as never, context as never);
    const processor = new PinnedStateProcessor({
      principalsKey: run => knowledge.__principalsKey(run),
      readPins: run => knowledge.__deliveredPins(run),
    });
    const args = (overrides: Record<string, unknown> = {}) =>
      ({
        threadId: 'alpha',
        resourceId: 'user-42',
        stepNumber: 0,
        requestContext,
        contextWindow: { hasSnapshot: false },
        lastSnapshot: undefined,
        deltasSinceSnapshot: [],
        ...overrides,
      }) as any;
    return { call, processor, args };
  }

  it('drives the processor end to end: snapshot, delta on an edit, and lane clear on unpin', async () => {
    const { call, processor, args } = harness();
    await call('knowledge_page', { op: 'write', page: 'policy:acme#tone', body: 'Answer in French.' });
    await call('knowledge_pin', { op: 'pin', page: 'policy:acme#tone', audience: ['org:acme'] });

    const snapshot = await processor.computeStateSignal(args());
    expect(snapshot).toMatchObject({ mode: 'snapshot' });
    expect(snapshot!.contents).toContain('Answer in French.');
    const first = (snapshot as any).value.pins;
    const base = { metadata: { state: { mode: 'snapshot' }, value: { pins: first } } };

    // Nothing changed: no signal, so the cached prefix stays put.
    expect(await processor.computeStateSignal(args({ contextWindow: { hasSnapshot: true }, lastSnapshot: base }))).toBe(
      undefined,
    );

    // Pins follow the page: an edit shows up as remove + add of the same id.
    await call('knowledge_page', { op: 'write', page: 'policy:acme#tone', body: 'Answer in German.' });
    const delta = await processor.computeStateSignal(
      args({ contextWindow: { hasSnapshot: true }, lastSnapshot: base }),
    );
    expect(delta).toMatchObject({ mode: 'delta' });
    const ops = (delta as any).delta.ops;
    expect(ops.map((op: any) => op.op)).toEqual(['remove', 'add']);
    expect(ops[1].pin.id).toBe(first[0].id);
    expect(ops[1].pin.text).toContain('Answer in German.');

    await call('knowledge_pin', { op: 'unpin', page: 'policy:acme#tone', audience: ['org:acme'] });
    const clear = await processor.computeStateSignal(
      args({ contextWindow: { hasSnapshot: true }, lastSnapshot: base }),
    );
    expect(clear).toMatchObject({ mode: 'snapshot', contents: '', attributes: { count: 0 } });
  });

  it('delivers nothing to a run on another org', async () => {
    const { call, processor, args } = harness();
    await call('knowledge_page', { op: 'write', page: 'policy:acme#tone', body: 'Answer in French.' });
    await call('knowledge_pin', { op: 'pin', page: 'policy:acme#tone', audience: ['org:acme'] });

    const other = new RequestContext();
    setRunAgentScopes(other, ['org:globex']);
    expect(await processor.computeStateSignal(args({ requestContext: other, resourceId: 'u-g' }))).toBe(undefined);
  });
});
