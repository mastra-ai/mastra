import { afterEach, describe, expect, it, vi } from 'vitest';
import { MastraClient } from '../client';
import storedThread from './__fixtures__/stored-thread.json';
import { tripCatalog } from './catalog.mock';
import { createGenUIDefinition, createSpecResolver } from './index';

/**
 * A `listMessages` response captured from the `examples/gen-ui` server, trimmed to its last four turns: a
 * json-render `data-spec` road trip, a second `data-spec` message, a `ui_spec` weekend plan written in strict
 * mode (state as a JSON string, nulls for unset fields), and a `ui_spec_edit` patching that plan after the user
 * ticked "Groceries".
 */
const WEEKEND = 'call_fVP2c5zMFRb5OKKFfR3Sfpp3';
const WEEKEND_EDIT = 'call_WzNPXq1uGVj1fXLRf0gPbPcj';
const ROAD_TRIP_MESSAGE = '0f9b4002-7b67-4a64-8aea-0c14d10129e9';

async function loadThread() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(storedThread), { headers: { 'content-type': 'application/json' } })),
  );
  const client = new MastraClient({ baseUrl: 'http://localhost:4111' });
  const { messages } = await client
    .getMemoryThread({ threadId: 'thread-7b0c22cd', agentId: 'genUIAgent' })
    .listMessages();
  const definition = createGenUIDefinition({ catalog: tripCatalog, specTool: true });
  const resolver = createSpecResolver({ specTool: definition.specTool });
  return { messages, resolver };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('reading the specs of a thread loaded from memory', () => {
  it('reads a spec the model wrote in strict mode', async () => {
    const { messages, resolver } = await loadThread();

    expect(resolver.update(messages)).toBe(true);

    const read = resolver.specForCall(WEEKEND);
    expect(read?.error).toBeUndefined();
    expect(read?.spec?.root).toBe('root');
    expect(read?.spec?.state).toEqual({ done: {} });
    expect(read?.spec?.elements.heading?.props).toMatchObject({ text: 'Weekend plan' });
    expect(read?.spec?.elements.root?.children).toEqual(['heading', 'chores']);
  });

  it('applies an edit to its target, starting from the state the user had set', async () => {
    const { messages, resolver } = await loadThread();
    resolver.update(messages);

    const read = resolver.specForCall(WEEKEND_EDIT);
    expect(read?.error).toBeUndefined();
    expect(read?.spec?.elements.heading?.props).toMatchObject({ text: 'Updated plan' });
    expect(read?.spec?.elements.budget).toMatchObject({ type: 'Card', props: { title: 'Budget' } });
    expect(read?.spec?.elements.root?.children).toEqual(['heading', 'chores', 'budget']);
    expect(read?.spec?.state).toEqual({ done: { Groceries: true } });
  });

  it('leaves the interface it edits as it was', async () => {
    const { messages, resolver } = await loadThread();
    resolver.update(messages);
    resolver.specForCall(WEEKEND_EDIT);

    expect(resolver.specForCall(WEEKEND)?.spec?.elements.heading?.props).toMatchObject({ text: 'Weekend plan' });
    expect(resolver.specForCall(WEEKEND)?.spec?.elements.budget).toBeUndefined();
  });

  it('builds the spec a message streamed as data-spec parts', async () => {
    const { messages, resolver } = await loadThread();
    resolver.update(messages);

    const read = resolver.readDataSpec(ROAD_TRIP_MESSAGE);
    expect(read.live).toBe(false);
    expect(read.spec?.root).toBe('trip');
    expect(read.spec?.state).toEqual({ packed: {} });
    expect(read.spec?.elements.trip?.children).toEqual(['title', 'days', 'packing']);
    expect(read.spec?.elements.days?.children).toEqual(['day-1', 'day-2', 'day-3', 'day-4']);
    expect(read.spec?.elements['day-4']?.props).toMatchObject({ title: 'Seville' });
  });

  it('does not report a change when the same thread is read again', async () => {
    const { messages, resolver } = await loadThread();
    resolver.update(messages);

    expect(resolver.update(messages)).toBe(false);
  });
});
