import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { accumulateGenUI, createGenUIState } from './accumulator';
import { createGenUIActionDispatcher, defineGenUIAction } from './actions';
import { createGenUIEmitter } from './emitter';
import type { GenUIChunk } from './emitter';
import { parsePartialJSON } from './partial-json';
import { createGenUISession } from './session';
import { validateModelInput, validateModelInputSync } from './standard-schema';
import type { StandardSchemaV1 } from './standard-schema';
import {
  createGenUIContextStore,
  createGenUIStateStore,
  editGenUIData,
  formatGenUIContext,
  mergeGenUIData,
  rebaseGenUIEdit,
} from './state';
import type { GenUIEnvelope, JSONObject } from './types';

const recorder = () => {
  const chunks: GenUIChunk[] = [];
  let id = 0;
  return {
    chunks,
    writer: { custom: (chunk: GenUIChunk) => void chunks.push(chunk) },
    generateEventId: () => `e${++id}`,
  };
};

/** A tiny Standard Schema implementation so these tests do not depend on zod. */
const schema = <T>(check: (value: unknown) => value is T, message: string): StandardSchemaV1<T> => ({
  '~standard': {
    version: 1,
    vendor: 'test',
    validate: value => (check(value) ? { value } : { issues: [{ message }] }),
  },
});

const assistant = (id: string, parts: unknown[]) => ({ id, role: 'assistant', content: { format: 2, parts } });
const part = (data: GenUIEnvelope) => ({ type: 'data-gen-ui', data });

describe('validateModelInput', () => {
  const product = z.object({
    name: z.string(),
    tagline: z.string().optional(),
    note: z.string().nullable(),
    specs: z.object({ color: z.string().optional() }),
    tags: z.array(z.string().nullable()),
  });

  it('accepts the nulls a strict-mode model sends for optional fields', () => {
    const input = { name: 'Lamp', tagline: null, note: null, specs: { color: null }, tags: ['oak', null] };
    const result = validateModelInputSync(product, input);
    expect(result).toEqual({ ok: true, value: { name: 'Lamp', note: null, specs: {}, tags: ['oak', null] } });
    expect(input.tagline).toBeNull();
  });

  it('still rejects nulls for required fields and reports the original error', async () => {
    const result = await validateModelInput(product, { name: null, note: null, specs: {}, tags: [] });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/^name: /);
  });
});

describe('createGenUIEmitter', () => {
  it('writes validated, versioned data-gen-ui chunks that the client reducer accepts', async () => {
    const { chunks, writer, generateEventId } = recorder();
    const ui = createGenUIEmitter(writer, { generateEventId, source: { agentId: 'weather' } }).surface('w1');
    await ui.create({ nodes: [{ id: 'card', component: 'WeatherCard', props: { city: 'Paris' } }] });
    await ui.updateProps('card', { temperature: 21 });
    await ui.setStatus('ready');

    expect(chunks.map(chunk => chunk.type)).toEqual(['data-gen-ui', 'data-gen-ui', 'data-gen-ui']);
    expect(chunks[0]!.data).toMatchObject({ version: 1, eventId: 'e1', surfaceId: 'w1' });

    const state = chunks.reduce((acc, chunk) => accumulateGenUI(acc, chunk.data), createGenUIState());
    expect(state.diagnostics).toEqual([]);
    expect(state.surfaces.w1).toMatchObject({ status: 'ready', source: { agentId: 'weather' } });
    expect(state.surfaces.w1!.nodes.card!.props).toEqual({ city: 'Paris', temperature: 21 });
  });

  it('rejects invalid operations on the server before anything is written', async () => {
    const { chunks, writer } = recorder();
    const ui = createGenUIEmitter(writer).surface('s');
    await expect(
      ui.upsertNodes([{ id: 'n', component: 'C', props: { bad: (() => 1) as unknown as string } }]),
    ).rejects.toThrow(/Invalid GenUI operations/);
    expect(chunks).toEqual([]);
  });

  it('gives each surface a unique id by default, so running the same tool twice in a thread shows two surfaces', async () => {
    const { chunks, writer } = recorder();
    const weatherTool = async (city: string, temp: number) => {
      const ui = createGenUIEmitter(writer).surface();
      await ui.create({ nodes: [{ id: 'card', component: 'WeatherCard', props: { city, temp: 0 } }] });
      await ui.updateProps('card', { temp });
      await ui.setStatus('ready');
    };
    await weatherTool('Paris', 18);
    await weatherTool('Paris', 25);

    const state = chunks.reduce((acc, chunk) => accumulateGenUI(acc, chunk.data), createGenUIState());
    expect(state.diagnostics).toEqual([]);
    expect(state.surfaceOrder).toHaveLength(2);
    expect(state.surfaceOrder.map(id => state.surfaces[id]!.nodes.card!.props.temp)).toEqual([18, 25]);
  });

  it('keeps later updates applicable when a write fails', async () => {
    const { chunks, generateEventId } = recorder();
    let failNext = false;
    const writer = {
      custom: (chunk: GenUIChunk) => {
        if (failNext) {
          failNext = false;
          throw new Error('stream closed');
        }
        chunks.push(chunk);
      },
    };
    const ui = createGenUIEmitter(writer, { generateEventId }).surface('w');
    await ui.create({ nodes: [{ id: 'card', component: 'WeatherCard', props: { temp: 0 } }] });
    failNext = true;
    await expect(ui.updateProps('card', { temp: 10 })).rejects.toThrow('stream closed');
    await ui.updateProps('card', { temp: 20 });

    const state = chunks.reduce((acc, chunk) => accumulateGenUI(acc, chunk.data), createGenUIState());
    expect(state.diagnostics).toEqual([]);
    expect(state.buffered).toEqual({});
    expect(state.surfaces.w!.nodes.card!.props.temp).toBe(20);
  });
});

describe('createGenUISession', () => {
  it('applies only new events while messages stream, keeping unchanged surfaces stable', () => {
    const { chunks, writer, generateEventId } = recorder();
    const emitter = createGenUIEmitter(writer, { generateEventId });
    void emitter.surface('a').create({ nodes: [{ id: 'root', component: 'Text', props: { text: 'a' } }] });
    void emitter.surface('b').create({ nodes: [{ id: 'root', component: 'Text', props: { text: 'b' } }] });
    void emitter.surface('b').updateProps('root', { text: 'b2' });

    const session = createGenUISession();
    const listener = vi.fn();
    session.subscribe(listener);

    const first = session.sync([
      assistant('m1', [{ type: 'text', text: 'Hel' }, part(chunks[0]!.data), part(chunks[1]!.data)]),
    ]);
    expect(first.surfaceOrder).toEqual(['a', 'b']);
    expect(listener).toHaveBeenCalledTimes(1);

    // Text token arrives: no GenUI change, same state reference, no notification.
    const second = session.sync([
      assistant('m1', [{ type: 'text', text: 'Hello' }, part(chunks[0]!.data), part(chunks[1]!.data)]),
    ]);
    expect(second).toBe(first);
    expect(listener).toHaveBeenCalledTimes(1);

    const third = session.sync([
      assistant('m1', [
        { type: 'text', text: 'Hello' },
        part(chunks[0]!.data),
        part(chunks[1]!.data),
        part(chunks[2]!.data),
      ]),
    ]);
    expect(third.surfaces.a).toBe(first.surfaces.a);
    expect(third.surfaces.b!.nodes.root!.props.text).toBe('b2');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('rebuilds deterministically when history is replaced (reload, regenerate)', () => {
    const { chunks, writer, generateEventId } = recorder();
    const ui = createGenUIEmitter(writer, { generateEventId }).surface('s');
    void ui.create({ nodes: [{ id: 'root', component: 'Text', props: { text: 'v1' } }] });
    void ui.updateProps('root', { text: 'v2' });

    const session = createGenUISession();
    session.sync([
      assistant(
        'm1',
        chunks.map(chunk => part(chunk.data)),
      ),
    ]);
    expect(session.getState().surfaces.s!.nodes.root!.props.text).toBe('v2');

    // History replaced by a regenerated answer that only contains the first event.
    session.sync([assistant('m2', [part(chunks[0]!.data)])]);
    expect(session.getState().surfaces.s!.nodes.root!.props.text).toBe('v1');

    const reloaded = createGenUISession();
    reloaded.sync([
      assistant(
        'm1',
        chunks.map(chunk => part(chunk.data)),
      ),
    ]);
    session.sync([
      assistant(
        'm1',
        chunks.map(chunk => part(chunk.data)),
      ),
    ]);
    expect(reloaded.getState()).toEqual(session.getState());
  });

  it('keeps out-of-band envelopes across rebuilds and deduplicates them against history', () => {
    const { chunks, writer, generateEventId } = recorder();
    const ui = createGenUIEmitter(writer, { generateEventId }).surface('panel');
    void ui.create({ placement: 'panel', nodes: [{ id: 'root', component: 'Progress', props: { pct: 0 } }] });
    void ui.updateProps('root', { pct: 50 });

    const session = createGenUISession();
    chunks.forEach(chunk => session.ingest(chunk.data));
    expect(session.getState().surfaces.panel!.nodes.root!.props.pct).toBe(50);

    // The same events later show up in persisted history: no duplicates, same result.
    session.sync([
      assistant(
        'm1',
        chunks.map(chunk => part(chunk.data)),
      ),
    ]);
    session.sync([]);
    expect(session.getState().surfaces.panel!.revision).toBe(2);
    expect(session.getState().surfaces.panel!.nodes.root!.props.pct).toBe(50);
  });
});

describe('parsePartialJSON', () => {
  it.each([
    ['', undefined],
    ['{', {}],
    ['{"ci', {}],
    ['{"city":', {}],
    ['{"city":"Par', { city: 'Par' }],
    ['{"city":"Paris","days":[1,2', { city: 'Paris', days: [1] }],
    ['{"city":"Paris","days":[1,2,', { city: 'Paris', days: [1, 2] }],
    ['{"city":"Paris","days":[1,2],"ok":tr', { city: 'Paris', days: [1, 2] }],
    ['{"n":12.', {}],
    ['{"n":-', {}],
    ['{"a":{"b":[{"c":"d', { a: { b: [{ c: 'd' }] } }],
    ['{"esc":"line\\nnext\\', { esc: 'line\nnext' }],
  ])('parses %j progressively', (text, expected) => {
    expect(parsePartialJSON(text).value).toEqual(expected);
  });

  it('reports completion only for valid JSON', () => {
    expect(parsePartialJSON('{"a":1}')).toEqual({ value: { a: 1 }, complete: true });
    expect(parsePartialJSON('{"a":1').complete).toBe(false);
  });

  it('returns undefined for malformed text and never pollutes prototypes', () => {
    expect(parsePartialJSON('{"a" 1').value).toBeUndefined();
    const parsed = parsePartialJSON('{"__proto__":{"polluted":true},"x":"y"');
    expect(parsed.value).toEqual({ x: 'y' });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('createGenUIStateStore', () => {
  it('keeps scopes isolated and notifies only the changed scope', () => {
    const store = createGenUIStateStore();
    const a = { kind: 'surface', id: 'a' } as const;
    const b = { kind: 'surface', id: 'b' } as const;
    const onA = vi.fn();
    const onB = vi.fn();
    store.subscribe(a, onA);
    store.subscribe(b, onB);

    store.patch(a, { filter: 'EU' });
    expect(store.get(a)).toEqual({ value: { filter: 'EU' }, revision: 1 });
    expect(store.get(b)).toEqual({ value: {}, revision: 0 });
    expect(onA).toHaveBeenCalledTimes(1);
    expect(onB).not.toHaveBeenCalled();
  });

  it('reports conflicts instead of silently overwriting a concurrent write', () => {
    const store = createGenUIStateStore();
    const scope = { kind: 'thread', id: 't1' } as const;
    const seen = store.get(scope).revision;
    store.patch(scope, { draft: 'from tab A' });
    const result = store.patch(scope, { draft: 'from tab B' }, { expectedRevision: seen });
    expect(result).toMatchObject({ ok: false, reason: 'conflict' });
    expect(store.get(scope).value).toEqual({ draft: 'from tab A' });
  });

  it('rejects non-serializable values', () => {
    const store = createGenUIStateStore();
    expect(() => store.set({ kind: 'surface', id: 's' }, { when: new Date() as never })).toThrow();
  });
});

describe('shared agent data with local edits', () => {
  it('overlays user edits on agent data and flags only keys the agent changed after the user edited them', () => {
    let data: JSONObject = { region: 'EU', limit: 10, sort: 'name' };
    let edits = editGenUIData({}, data, 'region', 'US');
    edits = editGenUIData(edits, data, 'limit', 25);
    expect(mergeGenUIData(data, edits)).toEqual({ value: { region: 'US', limit: 25, sort: 'name' }, conflicts: [] });

    // The agent changes an unedited key, an edited key, and converges on the user's value for another.
    data = { region: 'APAC', limit: 25, sort: 'date' };
    const merged = mergeGenUIData(data, edits);
    expect(merged.value).toEqual({ region: 'US', limit: 25, sort: 'date' });
    expect(merged.conflicts).toEqual(['region']);

    // Keeping the local value acknowledges the agent's new value and clears the conflict.
    edits = rebaseGenUIEdit(edits, data, 'region');
    expect(mergeGenUIData(data, edits)).toEqual({ value: { region: 'US', limit: 25, sort: 'date' }, conflicts: [] });
  });

  it('drops an edit that matches the agent value and compares structured values by content', () => {
    const data: JSONObject = { tags: ['a', 'b'], range: { from: 1, to: 2 } };
    expect(editGenUIData({}, data, 'tags', ['a', 'b'])).toEqual({});
    const edits = editGenUIData({}, data, 'range', { to: 3, from: 1 });
    expect(mergeGenUIData({ range: { to: 2, from: 1 }, tags: ['a', 'b'] }, edits).conflicts).toEqual([]);
    expect(mergeGenUIData({ range: { from: 0, to: 2 } }, edits).conflicts).toEqual(['range']);
  });

  it('treats a key the agent adds after a local-only edit as a conflict, and a removed key as one too', () => {
    const edits = editGenUIData({}, {}, 'note', 'mine');
    expect(mergeGenUIData({ note: 'agent' }, edits).conflicts).toEqual(['note']);
    const edited = editGenUIData({}, { note: 'agent' }, 'note', 'mine');
    expect(mergeGenUIData({}, edited)).toEqual({ value: { note: 'mine' }, conflicts: ['note'] });
  });
});

describe('createGenUIContextStore', () => {
  it('stores published context locally and formats it as clearly delimited data', () => {
    const context = createGenUIContextStore();
    const listener = vi.fn();
    context.subscribe(listener);
    context.publish('selectedRegion', { description: 'region selected in the filter panel', value: 'EU' });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(context.snapshot()).toEqual({
      selectedRegion: { description: 'region selected in the filter panel', value: 'EU' },
    });
    expect(formatGenUIContext(context.snapshot())).toContain(
      '- selectedRegion (region selected in the filter panel): "EU"',
    );
    context.unpublish('selectedRegion');
    expect(formatGenUIContext(context.snapshot())).toBeUndefined();
  });

  it('enforces a size limit so large app state is not sent by accident', () => {
    const context = createGenUIContextStore({ maxSize: 50 });
    expect(() => context.publish('big', { value: 'x'.repeat(100) })).toThrow(/exceeds 50/);
    expect(context.snapshot()).toEqual({});
  });
});

describe('createGenUIActionDispatcher', () => {
  const surfaceState = () => {
    const { chunks, writer, generateEventId } = recorder();
    const ui = createGenUIEmitter(writer, { generateEventId }).surface('form');
    void ui.create({ nodes: [{ id: 'approve', component: 'ApproveButton', props: { label: 'Approve' } }] });
    return {
      ui,
      chunks,
      state: () => chunks.reduce((acc, chunk) => accumulateGenUI(acc, chunk.data), createGenUIState()),
    };
  };

  const isAmount = (value: unknown): value is { amount: number } =>
    typeof value === 'object' && value !== null && typeof (value as { amount?: unknown }).amount === 'number';

  it('validates the payload, runs the handler once per action id, and returns the cached result on retry', async () => {
    const { state } = surfaceState();
    const handle = vi.fn(async (payload: { amount: number }) => payload.amount * 2);
    const dispatcher = createGenUIActionDispatcher({
      getSurface: id => state().surfaces[id],
      handlers: { submit: defineGenUIAction({ schema: schema(isAmount, 'amount must be a number'), handle }) },
    });
    const action = { actionId: 'a1', surfaceId: 'form', nodeId: 'approve', name: 'submit', sourceRevision: 1 };

    expect(await dispatcher.dispatch({ ...action, payload: { amount: 'x' } })).toEqual({
      status: 'invalid',
      error: 'amount must be a number',
    });
    expect(handle).not.toHaveBeenCalled();

    const [r1, r2] = await Promise.all([
      dispatcher.dispatch({ ...action, actionId: 'a2', payload: { amount: 2 } }),
      dispatcher.dispatch({ ...action, actionId: 'a2', payload: { amount: 2 } }),
    ]);
    expect(r1).toEqual({ status: 'success', value: 4 });
    expect(r2).toBe(r1);
    expect(await dispatcher.dispatch({ ...action, actionId: 'a2', payload: { amount: 2 } })).toEqual(r1);
    expect(handle).toHaveBeenCalledTimes(1);
  });

  it('rejects actions from a node that changed after it was rendered', async () => {
    const { ui, state } = surfaceState();
    void ui.updateProps('approve', { label: 'Amount changed — review again' });
    const handle = vi.fn();
    const dispatcher = createGenUIActionDispatcher({
      getSurface: id => state().surfaces[id],
      handlers: { submit: { handle } },
    });
    const result = await dispatcher.dispatch({
      surfaceId: 'form',
      nodeId: 'approve',
      name: 'submit',
      sourceRevision: 1,
    });
    expect(result.status).toBe('stale');
    expect(handle).not.toHaveBeenCalled();
  });

  it('reports unhandled actions and busy duplicates, and exposes pending state for loading UI', async () => {
    let release!: () => void;
    const handle = vi.fn(() => new Promise<void>(resolve => (release = resolve)));
    const dispatcher = createGenUIActionDispatcher({ handlers: { save: { handle } } });
    const base = { surfaceId: 's', nodeId: 'n', sourceRevision: 0 };

    expect((await dispatcher.dispatch({ ...base, name: 'nope' })).status).toBe('unhandled');

    const pending = dispatcher.dispatch({ ...base, name: 'save' });
    expect(dispatcher.isPending({ surfaceId: 's', name: 'save' })).toBe(true);
    expect((await dispatcher.dispatch({ ...base, name: 'save' })).status).toBe('busy');
    release();
    expect((await pending).status).toBe('success');
    expect(dispatcher.isPending({ surfaceId: 's' })).toBe(false);
  });

  it('cancels in-flight actions through the abort signal and allows a retry with the same id', async () => {
    let calls = 0;
    const dispatcher = createGenUIActionDispatcher({
      handlers: {
        slow: {
          handle: (_payload, { signal }) =>
            ++calls === 1
              ? new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))))
              : 'done',
        },
      },
    });
    const input = { actionId: 'x', surfaceId: 's', nodeId: 'n', name: 'slow', sourceRevision: 0 };
    const first = dispatcher.dispatch(input);
    dispatcher.cancel('x');
    expect(await first).toEqual({ status: 'cancelled' });
    expect(await dispatcher.dispatch(input)).toEqual({ status: 'success', value: 'done' });
  });

  it('surfaces handler errors without throwing', async () => {
    const dispatcher = createGenUIActionDispatcher({
      handlers: {
        boom: {
          handle: () => {
            throw new Error('network down');
          },
        },
      },
    });
    expect(await dispatcher.dispatch({ surfaceId: 's', nodeId: 'n', name: 'boom', sourceRevision: 0 })).toEqual({
      status: 'error',
      error: 'network down',
    });
  });
});
