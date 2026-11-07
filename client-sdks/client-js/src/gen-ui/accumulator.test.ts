import { describe, expect, it } from 'vitest';

import { accumulateGenUI, createGenUIState, extractGenUIEnvelopes, reduceGenUIMessages } from './accumulator';
import type { GenUIEnvelope, GenUIOperation, GenUISpec, GenUIState } from './types';

let seq = 0;
const env = (surfaceId: string, operations: GenUIOperation[], extra: Partial<GenUIEnvelope> = {}): GenUIEnvelope => ({
  version: 1,
  eventId: `e${++seq}`,
  surfaceId,
  operations,
  ...extra,
});

const applyAll = (envelopes: unknown[], state: GenUIState = createGenUIState()) =>
  envelopes.reduce<GenUIState>((acc, envelope) => accumulateGenUI(acc, envelope), state);

const dashboardSpec = (): GenUISpec => ({
  root: 'root',
  elements: {
    root: { type: 'Stack', props: { gap: 2 }, children: ['title', 'kpi'] },
    title: { type: 'Text', props: { text: 'Sales' } },
    kpi: { type: 'Metric', props: { label: 'Revenue', value: { $state: '/revenue' } } },
  },
  state: { revenue: 42 },
});

const dashboard = () => env('dash', [{ op: 'createSurface', title: 'Sales', spec: dashboardSpec() }]);

describe('accumulateGenUI', () => {
  it('creates a surface from a json-render spec', () => {
    const state = applyAll([dashboard()]);
    expect(state.surfaceOrder).toEqual(['dash']);
    expect(state.surfaces.dash).toMatchObject({
      status: 'streaming',
      placement: 'inline',
      title: 'Sales',
      revision: 1,
      spec: dashboardSpec(),
    });
  });

  it('starts from an empty spec that patches fill in, like a streamed json-render spec', () => {
    const state = applyAll([
      env('s', [{ op: 'createSurface' }]),
      env('s', [
        {
          op: 'patch',
          patches: [
            { op: 'add', path: '/root', value: 'card' },
            { op: 'add', path: '/elements/card', value: { type: 'Card', props: { title: 'Hi' }, children: [] } },
            { op: 'add', path: '/elements/card/children/-', value: 'body' },
            { op: 'add', path: '/elements/body', value: { type: 'Text', props: { text: 'Hello' } } },
            { op: 'add', path: '/state/count', value: 1 },
          ],
        },
      ]),
    ]);
    expect(state.surfaces.s!.spec).toEqual({
      root: 'card',
      elements: {
        card: { type: 'Card', props: { title: 'Hi' }, children: ['body'] },
        body: { type: 'Text', props: { text: 'Hello' } },
      },
      state: { count: 1 },
    });
  });

  it('is idempotent for duplicate event ids', () => {
    const create = dashboard();
    const once = applyAll([create]);
    expect(accumulateGenUI(once, create)).toBe(once);
  });

  it('never mutates the previous state', () => {
    const before = applyAll([dashboard()]);
    const snapshot = structuredClone(before);
    const after = accumulateGenUI(
      before,
      env('dash', [{ op: 'patch', patches: [{ op: 'replace', path: '/elements/title/props/text', value: 'Q4' }] }]),
    );
    expect(before).toEqual(snapshot);
    expect(after.surfaces.dash!.spec.elements.title!.props.text).toBe('Q4');
    expect(after.surfaces.dash!.revision).toBe(2);
  });

  it('a copied value does not share containers with its source', () => {
    const state = applyAll([
      dashboard(),
      env('dash', [
        {
          op: 'patch',
          patches: [
            { op: 'copy', from: '/elements/title', path: '/elements/subtitle' },
            { op: 'replace', path: '/elements/subtitle/props/text', value: 'Copy' },
            { op: 'add', path: '/elements/root/children/-', value: 'subtitle' },
          ],
        },
      ]),
    ]);
    expect(state.surfaces.dash!.spec.elements.title!.props.text).toBe('Sales');
    expect(state.surfaces.dash!.spec.elements.subtitle!.props.text).toBe('Copy');
  });

  it('moves an element between parents within one envelope', () => {
    const state = applyAll([
      env('s', [
        {
          op: 'createSurface',
          spec: {
            root: 'root',
            elements: {
              root: { type: 'Stack', props: {}, children: ['a', 'b'] },
              a: { type: 'Box', props: {}, children: ['x'] },
              b: { type: 'Box', props: {}, children: [] },
              x: { type: 'Text', props: {} },
            },
          },
        },
      ]),
      env('s', [
        {
          op: 'patch',
          patches: [{ op: 'move', from: '/elements/a/children/0', path: '/elements/b/children/-' }],
        },
      ]),
    ]);
    expect(state.surfaces.s!.spec.elements.a!.children).toEqual([]);
    expect(state.surfaces.s!.spec.elements.b!.children).toEqual(['x']);
    expect(state.diagnostics).toEqual([]);
  });

  it('applies an envelope atomically: a failing patch leaves the surface untouched', () => {
    const before = applyAll([dashboard()]);
    const after = accumulateGenUI(
      before,
      env('dash', [
        {
          op: 'patch',
          patches: [
            { op: 'replace', path: '/elements/title/props/text', value: 'changed' },
            { op: 'test', path: '/state/revenue', value: 0 },
          ],
        },
      ]),
    );
    expect(after.surfaces.dash).toBe(before.surfaces.dash);
    expect(after.diagnostics.at(-1)).toMatchObject({ code: 'invalid-operation', surfaceId: 'dash' });
  });

  it('createSurface with replace rebuilds an existing surface in place instead of rejecting it', () => {
    const next: GenUISpec = { root: 'note', elements: { note: { type: 'Text', props: { text: 'Updated' } } } };
    const state = applyAll([
      dashboard(),
      env('dash', [{ op: 'setStatus', status: 'ready' }]),
      env('dash', [{ op: 'createSurface', replace: true, spec: next, title: 'Notes', placement: 'panel' }]),
    ]);
    expect(state.diagnostics).toEqual([]);
    expect(state.surfaceOrder).toEqual(['dash']);
    expect(state.surfaces.dash).toMatchObject({
      spec: next,
      title: 'Notes',
      placement: 'panel',
      revision: 3,
      status: 'streaming',
    });

    const created = applyAll([env('fresh', [{ op: 'createSurface', replace: true, spec: next }])]);
    expect(created.surfaces.fresh).toMatchObject({ spec: next, revision: 1 });

    const rejected = applyAll([dashboard(), env('dash', [{ op: 'createSurface', spec: next }])]);
    expect(rejected.diagnostics[0]?.code).toBe('surface-exists');
  });

  it('only lets patches target root, elements and state', () => {
    const before = applyAll([dashboard()]);
    for (const path of ['', '/title', '/elements/__proto__/x', '/state/constructor/prototype']) {
      const after = accumulateGenUI(before, env('dash', [{ op: 'patch', patches: [{ op: 'add', path, value: 1 }] }]));
      expect(after.surfaces.dash).toBe(before.surfaces.dash);
      expect(after.diagnostics.at(-1)?.code).toBe('invalid-envelope');
    }
  });

  it('rejects cycles', () => {
    const after = applyAll([
      dashboard(),
      env('dash', [{ op: 'patch', patches: [{ op: 'add', path: '/elements/kpi/children', value: ['root'] }] }]),
    ]);
    expect(after.surfaces.dash!.spec.elements.kpi!.children).toBeUndefined();
    expect(after.diagnostics.at(-1)?.code).toBe('invalid-graph');
  });

  // Each path to a shared child renders it again, so a few dozen elements can expand into billions of renders.
  it('rejects a spec whose elements share children, which would freeze the tab when rendered', () => {
    const elements: GenUISpec['elements'] = {};
    for (let level = 0; level < 30; level++) {
      elements[`l${level}a`] = { type: 'Box', props: {}, children: [`l${level + 1}a`, `l${level + 1}b`] };
      elements[`l${level}b`] = { type: 'Box', props: {}, children: [`l${level + 1}a`, `l${level + 1}b`] };
    }
    const state = applyAll([env('dag', [{ op: 'createSurface', spec: { root: 'l0a', elements } }])]);
    expect(state.surfaces.dag).toBeUndefined();
    expect(state.diagnostics[0]?.code).toBe('invalid-graph');
    expect(state.diagnostics[0]?.message).toMatch(/has two parents/);
  });

  it('allows children that have not streamed in yet', () => {
    const state = applyAll([
      env('s', [
        {
          op: 'createSurface',
          spec: { root: 'root', elements: { root: { type: 'Stack', props: {}, children: ['later'] } } },
        },
      ]),
    ]);
    expect(state.surfaces.s).toBeDefined();
    expect(state.diagnostics).toEqual([]);
  });

  it('enforces configurable limits', () => {
    const limits = { maxElementsPerSurface: 3 };
    const full = accumulateGenUI(
      createGenUIState(),
      env('big', [
        {
          op: 'createSurface',
          spec: {
            root: 'n0',
            elements: Object.fromEntries(Array.from({ length: 3 }, (_, i) => [`n${i}`, { type: 'Text', props: {} }])),
          },
        },
      ]),
      { limits },
    );
    const overflow = accumulateGenUI(
      full,
      env('big', [{ op: 'patch', patches: [{ op: 'add', path: '/elements/n3', value: { type: 'Text', props: {} } }] }]),
      { limits },
    );
    expect(Object.keys(overflow.surfaces.big!.spec.elements)).toHaveLength(3);
    expect(overflow.diagnostics[0]?.code).toBe('limit-exceeded');

    const deep = env('deep', [
      {
        op: 'createSurface',
        spec: {
          root: 'a',
          elements: {
            a: { type: 'Box', props: {}, children: ['b'] },
            b: { type: 'Box', props: {}, children: ['c'] },
            c: { type: 'Box', props: {} },
          },
        },
      },
    ]);
    expect(accumulateGenUI(createGenUIState(), deep, { limits: { maxTreeDepth: 2 } }).surfaces.deep).toBeUndefined();
    expect(accumulateGenUI(createGenUIState(), deep, { limits: { maxTreeDepth: 3 } }).surfaces.deep).toBeDefined();

    const big = accumulateGenUI(
      createGenUIState(),
      env('size', [{ op: 'createSurface', spec: { root: '', elements: {}, state: { blob: 'x'.repeat(200) } } }]),
      { limits: { maxSpecSize: 100 } },
    );
    expect(big.surfaces.size).toBeUndefined();
    expect(big.diagnostics[0]?.code).toBe('limit-exceeded');
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
        operations: [
          { op: 'createSurface', spec: { root: 'n', elements: { n: { type: 'C', props: { fn: () => 1 } } } } },
        ],
      },
      { version: 1, eventId: 'w', surfaceId: 's', operations: [{ op: 'createSurface', spec: { elements: {} } }] },
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
      'invalid-envelope',
    ]);
  });

  it('does not let model output pollute prototypes', () => {
    const payload = JSON.parse(
      '{"version":1,"eventId":"p","surfaceId":"s","operations":[{"op":"createSurface","spec":{"root":"n","elements":{"n":{"type":"C","props":{"constructor":{"prototype":{"polluted":true}}}}},"state":{"__proto__":{"polluted":true}}}}]}',
    );
    const state = accumulateGenUI(createGenUIState(), payload);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(state.surfaces.s).toBeUndefined();
    expect(state.diagnostics[0]?.code).toBe('invalid-envelope');
  });

  it('buffers updates that arrive before their surface is created, then applies them in order', () => {
    const update = env('dash', [{ op: 'patch', patches: [{ op: 'replace', path: '/state/revenue', value: 7 }] }]);
    const state = applyAll([update, dashboard()]);
    expect(state.surfaces.dash!.spec.state).toEqual({ revenue: 7 });
    expect(state.buffered).toEqual({});
  });

  it('uses baseRevision to reorder out-of-order envelopes and reject stale ones', () => {
    const step = (value: number, baseRevision: number) =>
      env('dash', [{ op: 'patch', patches: [{ op: 'add', path: '/state/step', value }] }], { baseRevision });

    const outOfOrder = applyAll([dashboard(), step(3, 2), step(2, 1)]);
    expect(outOfOrder.surfaces.dash!.spec.state).toEqual({ revenue: 42, step: 3 });
    expect(outOfOrder.surfaces.dash!.revision).toBe(3);

    const stale = accumulateGenUI(outOfOrder, step(0, 1));
    expect(stale.surfaces.dash!.spec.state).toEqual({ revenue: 42, step: 3 });
    expect(stale.diagnostics.at(-1)?.code).toBe('stale-revision');
  });

  it('keeps independent surfaces isolated', () => {
    const state = applyAll([
      dashboard(),
      env('other', [
        { op: 'createSurface', placement: 'panel', spec: { root: 't', elements: { t: { type: 'Text', props: {} } } } },
      ]),
      env('other', [{ op: 'patch', patches: [{ op: 'add', path: '/elements/t/props/text', value: 'x' }] }]),
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

  it('deleteSurface removes the surface and must come last', () => {
    const state = applyAll([dashboard(), env('dash', [{ op: 'deleteSurface' }])]);
    expect(state.surfaces.dash).toBeUndefined();
    expect(state.surfaceOrder).toEqual([]);

    const misplaced = applyAll([
      dashboard(),
      env('dash', [{ op: 'deleteSurface' }, { op: 'setStatus', status: 'ready' }]),
    ]);
    expect(misplaced.surfaces.dash).toBeDefined();
    expect(misplaced.diagnostics.at(-1)?.code).toBe('invalid-operation');
  });
});

describe('reduceGenUIMessages', () => {
  it('rebuilds the same state from persisted message history, ignoring other parts', () => {
    const create = dashboard();
    const update = env('dash', [{ op: 'patch', patches: [{ op: 'replace', path: '/state/revenue', value: 5 }] }]);
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
