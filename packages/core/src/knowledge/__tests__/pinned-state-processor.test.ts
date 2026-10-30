import { describe, expect, it } from 'vitest';
import { setRunAgentScopes } from '../../agent/scopes';
import { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage';
import { knowledgeMemoryScopes } from '../declarations';
import { Knowledge } from '../index';
import { KNOWLEDGE_READ_INSTRUCTIONS } from '../instructions';
import { applyPinOps, diffPins, PinnedStateProcessor } from '../pinned-state-processor';

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

  // r92: with the pinned Refund Policy in context, models still searched for it and read it again,
  // because nothing said a pinned entry is the page's current body.
  it('tells the model pinned entries are current, so it does not search for or read them again', () => {
    const { processor } = harness();
    const result = processor.processInput({ messages: [], systemMessages: [] } as any) as any;
    const preamble = result.systemMessages.at(-1).content as string;
    expect(preamble).toContain('its ref, its version and how many notes it has, then its full current body');
    expect(preamble).toContain('pass that ref and version to knowledge_page as page and expectedVersion');
    expect(preamble).toContain('Do not knowledge_search or knowledge_read a pinned page to confirm it');
    expect(preamble).toContain('a note count alone is no reason to read it');
    expect(KNOWLEDGE_READ_INSTRUCTIONS).toMatch(
      /^Use the Knowledge tools.*Pinned knowledge pages may already be in your context if <pinned-knowledge> tags are present/,
    );
    expect(KNOWLEDGE_READ_INSTRUCTIONS).toContain('without searching for or reading them again');
    expect(KNOWLEDGE_READ_INSTRUCTIONS).toContain('edit one with the version shown');
    expect(KNOWLEDGE_READ_INSTRUCTIONS).toContain('only when the answer depends on what its notes say');
  });

  it('drives the processor end to end: snapshot, delta on an edit, and lane clear on unpin', async () => {
    const { call, processor, args } = harness();
    await call('knowledge_page', { op: 'write', page: 'policy:acme#tone', body: 'Answer in French.' });
    await call('knowledge_pin', { op: 'pin', page: 'policy:acme#tone', audience: ['org:acme'] });

    const snapshot = await processor.computeStateSignal(args());
    expect(snapshot).toMatchObject({ mode: 'snapshot' });
    expect(snapshot!.contents).toContain('Answer in French.');
    const first = (snapshot as any).value.pins;
    expect(first[0]).toMatchObject({ name: expect.any(String), scope: 'policy:acme' });
    expect(first[0].text.startsWith(`${first[0].name} (`)).toBe(true);
    const base = { metadata: { state: { mode: 'snapshot' }, value: { pins: first } } };

    // Nothing changed: no signal, so the cached prefix stays put.
    expect(await processor.computeStateSignal(args({ contextWindow: { hasSnapshot: true }, lastSnapshot: base }))).toBe(
      undefined,
    );

    // Pins follow the page: an edit shows up as one change of the same id, not a remove and an add.
    await call('knowledge_page', { op: 'write', page: 'policy:acme#tone', body: 'Answer in German.' });
    const delta = await processor.computeStateSignal(
      args({ contextWindow: { hasSnapshot: true }, lastSnapshot: base }),
    );
    expect(delta).toMatchObject({ mode: 'delta' });
    const ops = (delta as any).delta.ops;
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ op: 'change', pin: { id: first[0].id } });
    expect(ops[0].pin.text).toContain('Answer in German.');
    expect(delta!.contents).toContain(`~ changed {id: ${first[0].id}}`);
    expect(delta!.contents).not.toContain('removed');
    expect(applyPinOps(first, ops)).toEqual([ops[0].pin]);

    // A removed pin keeps its display fields, so a UI can name what left.
    expect(
      diffPins([...first, { id: 'gone', text: 'Old (gone): x', name: 'Old', scope: 'policy:acme' }], first),
    ).toEqual([{ op: 'remove', id: 'gone', name: 'Old', scope: 'policy:acme' }]);

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
