import { describe, expect, it } from 'vitest';
import { accumulateGenUI, createGenUIState, extractGenUIEnvelopes, reduceGenUIMessages } from './accumulator';
import type { GenUIEnvelope, GenUIOperation, GenUIState } from './types';

let counter = 0;
const env = (surfaceId: string, operations: GenUIOperation[], extra: Partial<GenUIEnvelope> = {}): GenUIEnvelope => ({
  version: 1,
  eventId: `evt-${++counter}`,
  surfaceId,
  operations,
  ...extra,
});

const applyAll = (envelopes: unknown[], state: GenUIState = createGenUIState()) =>
  envelopes.reduce<GenUIState>((acc, envelope) => accumulateGenUI(acc, envelope), state);

const dashboard = () =>
  env('dash', [
    {
      op: 'createSurface',
      title: 'Sales',
      nodes: [
        { id: 'root', component: 'Stack', children: ['kpi', 'chart'] },
        { id: 'kpi', component: 'Metric', props: { label: 'Revenue', value: 10 } },
        { id: 'chart', component: 'Chart', props: { series: [1, 2, 3] } },
      ],
    },
  ]);

describe('accumulateGenUI', () => {
  it('builds a normalized surface tree from a createSurface envelope', () => {
    const state = applyAll([dashboard()]);
    const surface = state.surfaces.dash!;
    expect(state.surfaceOrder).toEqual(['dash']);
    expect(surface.rootId).toBe('root');
    expect(surface.status).toBe('streaming');
    expect(surface.placement).toBe('inline');
    expect(surface.revision).toBe(1);
    expect(surface.nodes.root!.children).toEqual(['kpi', 'chart']);
    expect(surface.nodes.kpi!.props).toEqual({ label: 'Revenue', value: 10 });
    expect(surface.anchorEventId).toBe(state.surfaces.dash!.anchorEventId);
  });

  it('updating one node keeps every other node, and the previous state, untouched', () => {
    const before = applyAll([dashboard()]);
    const after = accumulateGenUI(before, env('dash', [{ op: 'updateProps', nodeId: 'kpi', set: { value: 42 } }]));

    expect(after.surfaces.dash!.nodes.kpi!.props).toEqual({ label: 'Revenue', value: 42 });
    expect(after.surfaces.dash!.nodes.chart).toBe(before.surfaces.dash!.nodes.chart);
    expect(after.surfaces.dash!.nodes.root).toBe(before.surfaces.dash!.nodes.root);
    expect(before.surfaces.dash!.nodes.kpi!.props.value).toBe(10);
    expect(after.surfaces.dash!.nodes.kpi!.revision).toBe(2);
    expect(after.surfaces.dash!.nodes.chart!.revision).toBe(1);
  });

  it('an upsert with identical content keeps the node reference (no remount, no re-render)', () => {
    const before = applyAll([dashboard()]);
    const after = accumulateGenUI(
      before,
      env('dash', [{ op: 'upsertNodes', nodes: [{ id: 'chart', component: 'Chart', props: { series: [1, 2, 3] } }] }]),
    );
    expect(after.surfaces.dash!.nodes.chart).toBe(before.surfaces.dash!.nodes.chart);
  });

  it('duplicate event ids are ignored and return the same state reference (reconnect / replay)', () => {
    const create = dashboard();
    const update = env('dash', [{ op: 'patchData', set: { region: 'EU' } }]);
    const once = applyAll([create, update]);
    const twice = applyAll([create, update, create, update]);
    expect(twice).toEqual(once);
    expect(accumulateGenUI(once, update)).toBe(once);
  });

  it('reorders, inserts and deletes children through setChildren', () => {
    const state = applyAll([
      dashboard(),
      env('dash', [
        { op: 'upsertNodes', nodes: [{ id: 'note', component: 'Text', props: { text: 'hi' } }] },
        { op: 'setChildren', nodeId: 'root', children: ['chart', 'note'] },
      ]),
    ]);
    expect(state.surfaces.dash!.nodes.root!.children).toEqual(['chart', 'note']);
    // kpi is detached but still exists until removed
    expect(state.surfaces.dash!.nodes.kpi).toBeDefined();
  });

  it('removeNodes cascades to descendants and strips references from parents', () => {
    const state = applyAll([
      env('s', [
        {
          op: 'createSurface',
          nodes: [
            { id: 'root', component: 'Stack', children: ['group'] },
            { id: 'group', component: 'Stack', children: ['leaf'] },
            { id: 'leaf', component: 'Text' },
          ],
        },
      ]),
      env('s', [{ op: 'removeNodes', nodeIds: ['group'] }]),
    ]);
    expect(Object.keys(state.surfaces.s!.nodes)).toEqual(['root']);
    expect(state.surfaces.s!.nodes.root!.children).toEqual([]);
  });

  it('applies an envelope atomically: a failing operation leaves the surface unchanged', () => {
    const before = applyAll([dashboard()]);
    const after = accumulateGenUI(
      before,
      env('dash', [
        { op: 'updateProps', nodeId: 'kpi', set: { value: 99 } },
        { op: 'updateProps', nodeId: 'missing', set: { value: 1 } },
      ]),
    );
    expect(after.surfaces.dash).toBe(before.surfaces.dash);
    expect(after.diagnostics.at(-1)).toMatchObject({ code: 'invalid-operation', surfaceId: 'dash' });
  });

  it('rejects cycles', () => {
    const after = applyAll([dashboard(), env('dash', [{ op: 'setChildren', nodeId: 'kpi', children: ['root'] }])]);
    expect(after.surfaces.dash!.nodes.kpi!.children).toEqual([]);
    expect(after.diagnostics.at(-1)?.code).toBe('invalid-graph');
  });

  it('enforces configurable limits', () => {
    const limits = { maxNodesPerSurface: 3 };
    const create = env('big', [
      { op: 'createSurface', nodes: Array.from({ length: 3 }, (_, i) => ({ id: `n${i}`, component: 'Text' })) },
    ]);
    const full = accumulateGenUI(createGenUIState(), create, { limits });
    const overflow = accumulateGenUI(
      full,
      env('big', [{ op: 'upsertNodes', nodes: [{ id: 'n3', component: 'Text' }] }]),
      {
        limits,
      },
    );
    expect(Object.keys(overflow.surfaces.big!.nodes)).toHaveLength(3);
    expect(overflow.diagnostics[0]?.code).toBe('limit-exceeded');

    const deep = env('deep', [
      {
        op: 'createSurface',
        nodes: [
          { id: 'a', component: 'Box', children: ['b'] },
          { id: 'b', component: 'Box', children: ['c'] },
          { id: 'c', component: 'Box' },
        ],
      },
    ]);
    expect(accumulateGenUI(createGenUIState(), deep, { limits: { maxTreeDepth: 2 } }).surfaces.deep).toBeUndefined();
    expect(accumulateGenUI(createGenUIState(), deep, { limits: { maxTreeDepth: 3 } }).surfaces.deep).toBeDefined();
  });

  it('never throws on untrusted input and records a diagnostic instead', () => {
    const garbage: unknown[] = [
      null,
      'nope',
      { version: 1 },
      { version: 2, eventId: 'v2', surfaceId: 's', operations: [] },
      { version: 1, eventId: 'x', surfaceId: 's', operations: [{ op: 'eval', code: 'alert(1)' }] },
      { version: 1, eventId: 'y', surfaceId: 'has space', operations: [{ op: 'createSurface' }] },
      {
        version: 1,
        eventId: 'z',
        surfaceId: 's',
        operations: [{ op: 'createSurface', nodes: [{ id: 'n', component: 'C', props: { fn: () => 1 } }] }],
      },
    ];
    let state = createGenUIState();
    for (const item of garbage) state = accumulateGenUI(state, item);
    expect(state.surfaceOrder).toEqual([]);
    expect(state.diagnostics.map(d => d.code)).toEqual([
      'unsupported-version',
      'unsupported-version',
      'invalid-envelope',
      'unsupported-version',
      'invalid-envelope',
      'invalid-envelope',
      'invalid-envelope',
    ]);
  });

  it('does not let model output pollute prototypes', () => {
    const payload = JSON.parse(
      '{"version":1,"eventId":"p","surfaceId":"s","operations":[{"op":"createSurface","data":{"__proto__":{"polluted":true}},"nodes":[{"id":"n","component":"C","props":{"constructor":{"prototype":{"polluted":true}}}}]}]}',
    );
    const state = accumulateGenUI(createGenUIState(), payload);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(state.surfaces.s).toBeUndefined();
    expect(state.diagnostics[0]?.code).toBe('invalid-envelope');
  });

  it('buffers updates that arrive before their surface is created, then applies them in order', () => {
    const create = dashboard();
    const update = env('dash', [{ op: 'updateProps', nodeId: 'kpi', set: { value: 7 } }]);
    const state = applyAll([update, create]);
    expect(state.surfaces.dash!.nodes.kpi!.props.value).toBe(7);
    expect(state.buffered).toEqual({});
  });

  it('uses baseRevision to reorder out-of-order envelopes and reject stale ones', () => {
    const create = dashboard(); // -> revision 1
    const second = env('dash', [{ op: 'patchData', set: { step: 2 } }], { baseRevision: 1 });
    const third = env('dash', [{ op: 'patchData', set: { step: 3 } }], { baseRevision: 2 });

    const outOfOrder = applyAll([create, third, second]);
    expect(outOfOrder.surfaces.dash!.data).toEqual({ step: 3 });
    expect(outOfOrder.surfaces.dash!.revision).toBe(3);

    const stale = accumulateGenUI(
      outOfOrder,
      env('dash', [{ op: 'patchData', set: { step: 0 } }], { baseRevision: 1 }),
    );
    expect(stale.surfaces.dash!.data).toEqual({ step: 3 });
    expect(stale.diagnostics.at(-1)?.code).toBe('stale-revision');
  });

  it('keeps independent surfaces isolated', () => {
    const state = applyAll([
      dashboard(),
      env('other', [{ op: 'createSurface', placement: 'panel', nodes: [{ id: 'root', component: 'Text' }] }]),
      env('other', [{ op: 'updateProps', nodeId: 'root', set: { text: 'x' } }]),
    ]);
    expect(state.surfaceOrder).toEqual(['dash', 'other']);
    expect(state.surfaces.dash!.revision).toBe(1);
    expect(state.surfaces.other!.placement).toBe('panel');
  });

  it('setStatus records failures and clears the error on recovery', () => {
    const failed = applyAll([dashboard(), env('dash', [{ op: 'setStatus', status: 'failed', error: 'boom' }])]);
    expect(failed.surfaces.dash).toMatchObject({ status: 'failed', error: 'boom' });
    const ready = accumulateGenUI(failed, env('dash', [{ op: 'setStatus', status: 'ready' }]));
    expect(ready.surfaces.dash!.status).toBe('ready');
    expect(ready.surfaces.dash!.error).toBeUndefined();
  });

  it('deleteSurface removes the surface', () => {
    const state = applyAll([dashboard(), env('dash', [{ op: 'deleteSurface' }])]);
    expect(state.surfaces.dash).toBeUndefined();
    expect(state.surfaceOrder).toEqual([]);
  });
});

describe('reduceGenUIMessages', () => {
  it('rebuilds the same state from persisted message history, ignoring other parts', () => {
    const create = dashboard();
    const update = env('dash', [{ op: 'updateProps', nodeId: 'kpi', set: { value: 5 } }]);
    const messages = [
      { id: 'u1', role: 'user', content: { format: 2, parts: [{ type: 'text', text: 'show sales' }] } },
      {
        id: 'a1',
        role: 'assistant',
        content: {
          format: 2,
          parts: [
            { type: 'text', text: 'Here you go' },
            { type: 'data-gen-ui', data: create },
            { type: 'data-progress', data: { pct: 50 } },
            { type: 'data-gen-ui', data: update },
          ],
        },
      },
    ];
    expect(extractGenUIEnvelopes(messages).map(ref => ref.partIndex)).toEqual([1, 3]);
    const live = applyAll([create, update]);
    const replayed = reduceGenUIMessages(messages);
    expect(replayed).toEqual(live);
    expect(reduceGenUIMessages(messages)).toEqual(replayed);
  });
});
