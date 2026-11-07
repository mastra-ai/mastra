import { describe, expect, it, vi } from 'vitest';
import { accumulateGenUI, createGenUIState } from './accumulator';
import { createGenUIEmitter } from './emitter';
import type { GenUIChunk } from './emitter';
import { parsePartialJSON } from './partial-json';
import { createGenUISession } from './session';
import { createGenUIContextStore, editGenUIState, formatGenUIContext, mergeGenUIState, rebaseGenUIEdit } from './state';
import type { GenUIEnvelope, GenUIPatch, GenUISpec, JSONObject } from './types';

const recorder = () => {
  const chunks: GenUIChunk[] = [];
  let id = 0;
  return {
    chunks,
    writer: { custom: (chunk: GenUIChunk) => void chunks.push(chunk) },
    generateEventId: () => `e${++id}`,
  };
};

const assistant = (id: string, parts: unknown[]) => ({ id, role: 'assistant', content: { format: 2, parts } });
const part = (data: GenUIEnvelope) => ({ type: 'data-gen-ui', data });

const card = (type: string, props: JSONObject, state?: JSONObject): GenUISpec => ({
  root: 'card',
  elements: { card: { type, props, children: [] } },
  ...(state ? { state } : {}),
});

const replay = (chunks: GenUIChunk[]) =>
  chunks.reduce((acc, chunk) => accumulateGenUI(acc, chunk.data), createGenUIState());

describe('createGenUIEmitter', () => {
  it('writes validated, versioned data-gen-ui chunks that the client reducer accepts', async () => {
    const { chunks, writer, generateEventId } = recorder();
    const ui = createGenUIEmitter(writer, { generateEventId, source: { agentId: 'weather' } }).surface('w1');
    await ui.create({ spec: card('WeatherCard', { city: 'Paris' }) });
    await ui.patch([{ op: 'add', path: '/elements/card/props/temperature', value: 21 }]);
    await ui.setStatus('ready');

    expect(chunks.map(chunk => chunk.type)).toEqual(['data-gen-ui', 'data-gen-ui', 'data-gen-ui']);
    expect(chunks[0]!.data).toMatchObject({ version: 1, eventId: 'e1', surfaceId: 'w1' });

    const state = replay(chunks);
    expect(state.diagnostics).toEqual([]);
    expect(state.surfaces.w1).toMatchObject({ status: 'ready', source: { agentId: 'weather' } });
    expect(state.surfaces.w1!.spec.elements.card!.props).toEqual({ city: 'Paris', temperature: 21 });
  });

  it('writes agent state that elements read with $state, creating the state object when missing', async () => {
    const { chunks, writer, generateEventId } = recorder();
    const ui = createGenUIEmitter(writer, { generateEventId }).surface('w');
    await ui.create({ spec: card('WeatherCard', { temp: { $state: '/forecast/temp' } }) });
    await ui.setState('/forecast', { temp: 18 });
    await ui.setState('/forecast/temp', 21);

    const state = replay(chunks);
    expect(state.diagnostics).toEqual([]);
    expect(state.surfaces.w!.spec.state).toEqual({ forecast: { temp: 21 } });
  });

  it('replaces the whole spec in one envelope', async () => {
    const { chunks, writer, generateEventId } = recorder();
    const ui = createGenUIEmitter(writer, { generateEventId }).surface('w');
    await ui.create({ spec: card('Skeleton', {}) });
    await ui.replace(card('WeatherCard', { city: 'Oslo' }));

    expect(replay(chunks).surfaces.w!.spec.elements.card).toEqual({
      type: 'WeatherCard',
      props: { city: 'Oslo' },
      children: [],
    });
  });

  it('rejects invalid operations on the server before anything is written', async () => {
    const { chunks, writer } = recorder();
    const ui = createGenUIEmitter(writer).surface('s');
    await expect(
      ui.patch([{ op: 'add', path: '/elements/n', value: { type: 'C', props: { bad: () => 1 } } }]),
    ).rejects.toThrow(/Invalid GenUI operations/);
    await expect(ui.patch([{ op: 'add', path: '/constructor/x', value: 1 }])).rejects.toThrow(
      /Invalid GenUI operations/,
    );
    await expect(ui.setState('', 1)).rejects.toThrow(/Invalid GenUI operations/);
    expect(chunks).toEqual([]);
  });

  it('gives each surface a unique id by default, so running the same tool twice in a thread shows two surfaces', async () => {
    const { chunks, writer } = recorder();
    const weatherTool = async (city: string, temp: number) => {
      const ui = createGenUIEmitter(writer).surface();
      await ui.create({ spec: card('WeatherCard', { city, temp: 0 }) });
      await ui.patch([{ op: 'replace', path: '/elements/card/props/temp', value: temp }]);
      await ui.setStatus('ready');
    };
    await weatherTool('Paris', 18);
    await weatherTool('Paris', 25);

    const state = replay(chunks);
    expect(state.diagnostics).toEqual([]);
    expect(state.surfaceOrder).toHaveLength(2);
    expect(state.surfaceOrder.map(id => state.surfaces[id]!.spec.elements.card!.props.temp)).toEqual([18, 25]);
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
    await ui.create({ spec: card('WeatherCard', {}, { temp: 0 }) });
    failNext = true;
    await expect(ui.setState('/temp', 10)).rejects.toThrow('stream closed');
    await ui.setState('/temp', 20);

    const state = replay(chunks);
    expect(state.diagnostics).toEqual([]);
    expect(state.buffered).toEqual({});
    expect(state.surfaces.w!.spec.state!.temp).toBe(20);
  });

  it('keeps later updates applicable when an earlier un-awaited write fails', async () => {
    const { chunks, generateEventId } = recorder();
    let calls = 0;
    const writer = {
      custom: async (chunk: GenUIChunk) => {
        calls += 1;
        const call = calls;
        await new Promise(resolve => setTimeout(resolve, 5));
        if (call === 2) throw new Error('stream closed');
        chunks.push(chunk);
      },
    };
    const ui = createGenUIEmitter(writer, { generateEventId }).surface('w');
    const results = await Promise.allSettled([
      ui.create({ spec: card('WeatherCard', {}, { temp: 0 }) }),
      ui.setState('/temp', 10),
      ui.setState('/temp', 20),
    ]);

    expect(results.map(result => result.status)).toEqual(['fulfilled', 'rejected', 'fulfilled']);
    const state = replay(chunks);
    expect(state.diagnostics).toEqual([]);
    expect(state.buffered).toEqual({});
    expect(state.surfaces.w!.spec.state!.temp).toBe(20);
  });

  it('links surfaces to the tool call when given the tool execution context', async () => {
    const { chunks, writer, generateEventId } = recorder();
    const context = { writer, agent: { toolCallId: 'call-1' } };
    await createGenUIEmitter(context, { generateEventId, source: { agentId: 'weather' } })
      .surface('w')
      .create({ spec: card('WeatherCard', {}) });
    await createGenUIEmitter(context, { generateEventId, source: { toolCallId: 'explicit' } })
      .surface('x')
      .create({ spec: card('WeatherCard', {}) });

    const sources = chunks.map(chunk => chunk.data.operations[0]);
    expect(sources).toMatchObject([
      { op: 'createSurface', source: { agentId: 'weather', toolCallId: 'call-1' } },
      { op: 'createSurface', source: { toolCallId: 'explicit' } },
    ]);
  });
});

describe('createGenUISession', () => {
  const text = (value: string) => card('Text', { text: value });
  const setText = (value: string): GenUIPatch[] => [{ op: 'replace', path: '/elements/card/props/text', value }];

  it('applies only new events while messages stream, keeping unchanged surfaces stable', async () => {
    const { chunks, writer, generateEventId } = recorder();
    const emitter = createGenUIEmitter(writer, { generateEventId });
    await emitter.surface('a').create({ spec: text('a') });
    await emitter.surface('b').create({ spec: text('b') });
    await emitter.surface('b').patch(setText('b2'));

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
    expect(third.surfaces.b!.spec.elements.card!.props.text).toBe('b2');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('rebuilds deterministically when history is replaced (reload, regenerate)', async () => {
    const { chunks, writer, generateEventId } = recorder();
    const ui = createGenUIEmitter(writer, { generateEventId }).surface('s');
    await ui.create({ spec: text('v1') });
    await ui.patch(setText('v2'));

    const session = createGenUISession();
    session.sync([
      assistant(
        'm1',
        chunks.map(chunk => part(chunk.data)),
      ),
    ]);
    expect(session.getState().surfaces.s!.spec.elements.card!.props.text).toBe('v2');

    // History replaced by a regenerated answer that only contains the first event.
    session.sync([assistant('m2', [part(chunks[0]!.data)])]);
    expect(session.getState().surfaces.s!.spec.elements.card!.props.text).toBe('v1');

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

  it('keeps out-of-band envelopes across rebuilds and deduplicates them against history', async () => {
    const { chunks, writer, generateEventId } = recorder();
    const ui = createGenUIEmitter(writer, { generateEventId }).surface('panel');
    await ui.create({ placement: 'panel', spec: card('Progress', { pct: { $state: '/pct' } }, { pct: 0 }) });
    await ui.setState('/pct', 50);

    const session = createGenUISession();
    chunks.forEach(chunk => session.ingest(chunk.data));
    expect(session.getState().surfaces.panel!.spec.state!.pct).toBe(50);

    // The same events later show up in persisted history: no duplicates, same result.
    session.sync([
      assistant(
        'm1',
        chunks.map(chunk => part(chunk.data)),
      ),
    ]);
    session.sync([]);
    expect(session.getState().surfaces.panel!.revision).toBe(2);
    expect(session.getState().surfaces.panel!.spec.state!.pct).toBe(50);
  });
});

describe('parsePartialJSON', () => {
  it('repairs streamed tool arguments progressively and flags completion', () => {
    expect(parsePartialJSON('')).toEqual({ value: undefined, complete: false });
    expect(parsePartialJSON('{"city":"Par')).toEqual({ value: { city: 'Par' }, complete: false });
    expect(parsePartialJSON('{"a":{"b":[{"c":"d').value).toEqual({ a: { b: [{ c: 'd' }] } });
    expect(parsePartialJSON('{"a":1}')).toEqual({ value: { a: 1 }, complete: true });
  });

  it('never pollutes prototypes', () => {
    parsePartialJSON('{"__proto__":{"polluted":true},"x":"y"');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('agent state with local edits', () => {
  it('overlays user edits on agent state and flags only paths the agent changed after the user edited them', () => {
    let state: JSONObject = { region: 'EU', limit: 10, sort: 'name' };
    let edits = editGenUIState({}, state, '/region', 'US');
    edits = editGenUIState(edits, state, '/limit', 25);
    expect(mergeGenUIState(state, edits)).toEqual({ value: { region: 'US', limit: 25, sort: 'name' }, conflicts: [] });

    // The agent changes an unedited path, an edited path, and converges on the user's value for another.
    state = { region: 'APAC', limit: 25, sort: 'date' };
    const merged = mergeGenUIState(state, edits);
    expect(merged.value).toEqual({ region: 'US', limit: 25, sort: 'date' });
    expect(merged.conflicts).toEqual(['/region']);

    // Keeping the local value acknowledges the agent's new value and clears the conflict.
    edits = rebaseGenUIEdit(edits, state, '/region');
    expect(mergeGenUIState(state, edits)).toEqual({ value: { region: 'US', limit: 25, sort: 'date' }, conflicts: [] });
  });

  it('edits nested paths without touching their siblings, and a parent edit replaces edits beneath it', () => {
    const state: JSONObject = { filters: { region: 'EU', tags: ['a'] }, page: 1 };
    let edits = editGenUIState({}, state, '/filters/region', 'US');
    edits = editGenUIState(edits, state, '/filters/tags/1', 'b');
    const merged = mergeGenUIState(state, edits);
    expect(merged.value).toEqual({ filters: { region: 'US', tags: ['a', 'b'] }, page: 1 });
    expect(state).toEqual({ filters: { region: 'EU', tags: ['a'] }, page: 1 });
    expect(merged.value.page).toBe(1);

    edits = editGenUIState(edits, state, '/filters', { region: 'APAC' });
    expect(Object.keys(edits)).toEqual(['/filters']);
    expect(mergeGenUIState(state, edits).value).toEqual({ filters: { region: 'APAC' }, page: 1 });
  });

  it('drops an edit that matches the agent value and compares structured values by content', () => {
    const state: JSONObject = { tags: ['a', 'b'], range: { from: 1, to: 2 } };
    expect(editGenUIState({}, state, '/tags', ['a', 'b'])).toEqual({});
    const edits = editGenUIState({}, state, '/range', { to: 3, from: 1 });
    expect(mergeGenUIState({ range: { to: 2, from: 1 }, tags: ['a', 'b'] }, edits).conflicts).toEqual([]);
    expect(mergeGenUIState({ range: { from: 0, to: 2 } }, edits).conflicts).toEqual(['/range']);
  });

  it('treats a path the agent adds after a local-only edit as a conflict, and a removed path as one too', () => {
    const edits = editGenUIState({}, {}, '/note', 'mine');
    expect(mergeGenUIState({ note: 'agent' }, edits).conflicts).toEqual(['/note']);
    const edited = editGenUIState({}, { note: 'agent' }, '/note', 'mine');
    expect(mergeGenUIState({}, edited)).toEqual({ value: { note: 'mine' }, conflicts: ['/note'] });
  });

  it('refuses paths that could pollute prototypes', () => {
    expect(() => editGenUIState({}, {}, '/__proto__/polluted', true)).toThrow();
    expect(() => editGenUIState({}, {}, 'region', 'US')).toThrow();
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
