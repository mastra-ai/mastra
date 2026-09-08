import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

import { createPinnedTools, listPinnedKnowledge, PINNED_NODE_NAME, Subconscious } from '../subconscious';

const resourceScope = ['org:acme', 'resource:user-42'];
const threadScope = [...resourceScope, 'thread:alpha'];

function createMemory() {
  const storage = new InMemoryStore();
  return { storage } as unknown as Parameters<typeof createPinnedTools>[0];
}

function createTools(
  memory: ReturnType<typeof createMemory>,
  overrides: Partial<Parameters<typeof createPinnedTools>[1]> = {},
) {
  return createPinnedTools(memory, {
    scope: threadScope,
    sourceThreadId: 'alpha',
    defaultScope: 'resource',
    maxPins: 20,
    maxCharacters: 2_000,
    ...overrides,
  });
}

async function getStore(memory: ReturnType<typeof createMemory>) {
  return (await (memory as any).storage.getStore('knowledge'))!;
}

describe('Subconscious pinned knowledge', () => {
  it('is off unless configured, and resolves a bounded budget when enabled', () => {
    expect(new Subconscious().resolved.pins).toBe(false);
    expect(new Subconscious({ pins: false }).resolved.pins).toBe(false);
    expect(new Subconscious({ pins: true }).resolved.pins).toEqual({
      maxPins: 20,
      maxCharacters: 2_000,
    });
    expect(new Subconscious({ pins: { maxCharacters: 500, maxPins: 3 } }).resolved.pins).toEqual({
      maxPins: 3,
      maxCharacters: 500,
    });
    expect(() => new Subconscious({ pins: { maxCharacters: 100_000 } })).toThrow(/maxCharacters/);
    expect(() => new Subconscious({ pins: { maxCharacters: 0 } })).toThrow(/maxCharacters/);
    expect(() => new Subconscious({ pins: { maxPins: 0 } })).toThrow(/maxPins/);
  });

  it('clamps org-level writes to the resource level so pins never outrun the reserved node', async () => {
    const memory = createMemory();
    const tools = createTools(memory, { defaultScope: 'org' });
    const explicit = await tools.knowledge_pin!.execute!({ text: 'explicit default' } as any, {} as any);
    expect(explicit.scope).toEqual(resourceScope);
    // An explicit org request is rejected by the tool schema: no second pin lands.
    const rejected = await tools.knowledge_pin!.execute!({ text: 'org ask', scope: 'org' } as any, {} as any);
    expect(rejected).toMatchObject({ error: true });
    expect((rejected as { message: string }).message).toContain('scope');
    const { pins } = await listPinnedKnowledge({ store: await getStore(memory), scope: threadScope });
    expect(pins.map(pin => pin.text)).toEqual(['explicit default']);
  });

  it('honors a thread maxScope ceiling: the reserved node itself is created at the thread level', async () => {
    const memory = createMemory();
    // defaultScope deliberately left at resource: an unscoped pin must narrow to the ceiling, not throw.
    const tools = createTools(memory, { maxScope: 'thread' });
    const pinned = await tools.knowledge_pin!.execute!({ text: 'thread ceiling pin' } as any, {} as any);
    const store = await getStore(memory);
    const entity = await store.getNode(pinned.node);
    expect(entity!.scope).toEqual(threadScope);
    const { pins } = await listPinnedKnowledge({ store, scope: threadScope });
    expect(pins.map(pin => pin.id)).toEqual([pinned.id]);
  });

  it('pins a KnowledgeRecord and assembles it into the pin set', async () => {
    const memory = createMemory();
    const tools = createTools(memory);
    const pinned = await tools.knowledge_pin!.execute!({ text: 'Always answer in French.' } as any, {} as any);
    const { pins } = await listPinnedKnowledge({ store: await getStore(memory), scope: threadScope });
    expect(pins).toHaveLength(1);
    expect(pins[0]!.id).toBe(pinned.id);
    expect(pins[0]!.text).toBe('Always answer in French.');
  });

  it('unpin soft-deletes the KnowledgeRecord and it leaves the assembled set', async () => {
    const memory = createMemory();
    const tools = createTools(memory);
    const pinned = await tools.knowledge_pin!.execute!({ text: 'Never force push.' } as any, {} as any);
    await tools.knowledge_unpin!.execute!({ recordId: pinned.id } as any, {} as any);
    const store = await getStore(memory);
    const { pins } = await listPinnedKnowledge({ store, scope: threadScope });
    expect(pins).toHaveLength(0);
    const raw = await store.getKnowledge({ id: pinned.id, includeDeleted: true });
    expect(raw?.deletedAt).toBeTruthy();
  });

  it('never returns a deleted KnowledgeRecord even when later reads overlap it', async () => {
    const memory = createMemory();
    const tools = createTools(memory);
    const a = await tools.knowledge_pin!.execute!({ text: 'keep me' } as any, {} as any);
    const b = await tools.knowledge_pin!.execute!({ text: 'drop me' } as any, {} as any);
    await tools.knowledge_unpin!.execute!({ recordId: b.id } as any, {} as any);
    const { pins } = await listPinnedKnowledge({ store: await getStore(memory), scope: threadScope });
    expect(pins.map(pin => pin.id)).toEqual([a.id]);
  });

  it('edit replaces the pin under a new KnowledgeRecord id and removes the old one', async () => {
    const memory = createMemory();
    const tools = createTools(memory);
    const pinned = await tools.knowledge_pin!.execute!({ text: 'Speak French.' } as any, {} as any);
    const edited = await tools.knowledge_edit_pin!.execute!(
      { recordId: pinned.id, text: 'Speak French. Loudly.' } as any,
      {} as any,
    );
    expect(edited.id).not.toBe(pinned.id);
    const { pins } = await listPinnedKnowledge({ store: await getStore(memory), scope: threadScope });
    expect(pins.map(pin => pin.id)).toEqual([edited.id]);
    expect(pins[0]!.text).toBe('Speak French. Loudly.');
  });

  it('stores a pin reason as KnowledgeRecord metadata and carries it forward through edits', async () => {
    const memory = createMemory();
    const tools = createTools(memory);
    const pinned = await tools.knowledge_pin!.execute!(
      { text: 'Never force push.', reason: 'Standing safety rule; violating it destroys history.' } as any,
      {} as any,
    );
    expect(pinned.metadata).toEqual({ reason: 'Standing safety rule; violating it destroys history.' });

    // Edit without a new reason carries the old metadata forward.
    const edited = await tools.knowledge_edit_pin!.execute!(
      { recordId: pinned.id, text: 'Never force push to shared branches.' } as any,
      {} as any,
    );
    expect(edited.metadata).toEqual({ reason: 'Standing safety rule; violating it destroys history.' });

    // Edit with a new reason replaces the old one.
    const reReasoned = await tools.knowledge_edit_pin!.execute!(
      { recordId: edited.id, text: 'Never force push, ever.', reason: 'Updated after the incident.' } as any,
      {} as any,
    );
    expect(reReasoned.metadata).toEqual({ reason: 'Updated after the incident.' });
  });

  it('rejects an over-budget pin naming the character limit, and an over-count pin naming the pin limit', async () => {
    const memory = createMemory();
    const tools = createTools(memory, { maxCharacters: 40, maxPins: 1 });
    await expect(tools.knowledge_pin!.execute!({ text: 'x'.repeat(41) } as any, {} as any)).rejects.toThrow(
      /limited to 40 characters/,
    );
    await tools.knowledge_pin!.execute!({ text: 'short' } as any, {} as any);
    await expect(tools.knowledge_pin!.execute!({ text: 'one too many' } as any, {} as any)).rejects.toThrow(
      /at most 1/,
    );
  });

  it('a pin written at the narrowest scope level is visible through the read expression', async () => {
    const memory = createMemory();
    const tools = createTools(memory);
    const pinned = await tools.knowledge_pin!.execute!({ text: 'thread-only pin', scope: 'thread' } as any, {} as any);
    expect(pinned.scope).toContain('thread:alpha');
    const { pins } = await listPinnedKnowledge({ store: await getStore(memory), scope: threadScope });
    expect(pins.map(pin => pin.id)).toEqual([pinned.id]);
  });

  it('a pin written at the default write scope is visible in the same turn', async () => {
    const memory = createMemory();
    const tools = createTools(memory);
    const pinned = await tools.knowledge_pin!.execute!({ text: 'resource pin' } as any, {} as any);
    expect(pinned.scope).not.toContain('thread:alpha');
    const { pins } = await listPinnedKnowledge({ store: await getStore(memory), scope: threadScope });
    expect(pins.map(pin => pin.id)).toEqual([pinned.id]);
  });

  it('resolves one reserved node across pins written at two different scopes', async () => {
    const memory = createMemory();
    const tools = createTools(memory);
    const a = await tools.knowledge_pin!.execute!({ text: 'wide pin', scope: 'resource' } as any, {} as any);
    const b = await tools.knowledge_pin!.execute!({ text: 'narrow pin', scope: 'thread' } as any, {} as any);
    expect(a.node).toBe(b.node);
    const store = await getStore(memory);
    const entity = await store.getNode(a.node);
    expect(entity?.name).toBe(PINNED_NODE_NAME);
    const { pins, nodeId } = await listPinnedKnowledge({ store, scope: threadScope });
    expect(nodeId).toBe(a.node);
    expect(pins).toHaveLength(2);
  });
});
