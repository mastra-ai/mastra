import { InMemoryStore, MAX_KNOWLEDGE_NODE_DESCRIPTION_LENGTH } from '@mastra/core/storage';
import { GoogleSchemaCompatLayer } from '@mastra/schema-compat';
import { standardSchemaToJSONSchema } from '@mastra/schema-compat/schema';
import { describe, expect, it } from 'vitest';

import { Memory } from '../..';
import { createKnowledgeWriteTools } from '../../processors/observational-memory/subconscious/knowledge-write-tools';

const scope = ['org:acme', 'resource:user-42', 'thread:alpha'];

async function fixture() {
  const memory = new Memory({ storage: new InMemoryStore() });
  const store = (await memory.storage.getStore('knowledge'))!;
  const source = await store.createNode({ name: 'Atlas Initiative', kind: 'project', scope });
  const target = await store.createNode({ name: 'Project Atlas', kind: 'project', scope });
  const tools = createKnowledgeWriteTools(memory, {
    scope,
    sourceThreadId: 'alpha',
    defaultScope: 'resource',
    maxScope: 'resource',
  });
  return { store, source, target, tools };
}

describe('Subconscious knowledge write tools', () => {
  it('keeps snapshots of all eight public input schemas', async () => {
    const { tools } = await fixture();
    // Snapshot the resolved JSON Schema, not the wrapper: `tool.inputSchema` serializes to
    // an opaque `JsonSchemaWrapper` whose snapshot never changes when the schema does.
    expect(
      Object.fromEntries(
        Object.entries(tools).map(([name, tool]) => [
          name,
          standardSchemaToJSONSchema(tool.inputSchema as never, { io: 'input' }),
        ]),
      ),
    ).toMatchSnapshot();
  });

  it('keeps tool schemas free of top-level composition keywords Gemini rejects', async () => {
    // Google's API rejects `required` inside non-OBJECT anyOf branches, and the
    // schema-compat Google layer preserves root-level unions as-is — so these
    // tool schemas must not use top-level composition keywords (regression: the old
    // knowledge node-edit `anyOf: [{ required: ['name'] }, { required: ['kind'] }]`
    // made every Gemini curation fail with a 400 before the model ran).
    const { tools } = await fixture();
    expect(Object.keys(tools).length).toBeGreaterThan(0);
    for (const [name, tool] of Object.entries(tools)) {
      const schema = standardSchemaToJSONSchema(tool.inputSchema as never, { io: 'input' }) as Record<string, unknown>;
      // Guard against the wrapper hiding the schema and this test passing vacuously.
      expect(schema.type).toBe('object');
      expect({ name, anyOf: schema.anyOf, oneOf: schema.oneOf, allOf: schema.allOf }).toEqual({
        name,
        anyOf: undefined,
        oneOf: undefined,
        allOf: undefined,
      });
    }
  });

  it('reaches Google with the node-edit rule intact, one required field per tool', async () => {
    // The rule used to be enforced in `execute`, so the model was never told it — it found
    // out by being thrown at. It now lives in the schema, and this asserts the shape still
    // says so after the Google compat layer has rewritten it: that layer drops every
    // sibling key of an `anyOf`, so a union here (root-level or nested) would arrive with
    // no properties at all and hide the fields from the model entirely.
    const { tools } = await fixture();
    const compat = new GoogleSchemaCompatLayer({
      provider: 'google',
      modelId: 'gemini-3.1-pro-preview',
      supportsStructuredOutputs: true,
    });
    const onTheWire = (id: string) =>
      standardSchemaToJSONSchema(compat.processToCompatSchema(tools[id]!.inputSchema as never) as never, {
        io: 'input',
      }) as any;

    const rename = onTheWire('knowledge_rename_node');
    expect(rename.anyOf ?? rename.oneOf ?? rename.allOf).toBeUndefined();
    expect(rename.required).toEqual(['node', 'expectedVersion', 'name']);
    expect(rename.properties.name.type).toBe('string');
    expect(rename.properties.name.nullable).toBeUndefined();

    const setKind = onTheWire('knowledge_set_node_kind');
    expect(setKind.anyOf ?? setKind.oneOf ?? setKind.allOf).toBeUndefined();
    expect(setKind.required).toEqual(['node', 'expectedVersion', 'kind']);
    expect(setKind.properties.kind.type).toBe('string');
    expect(setKind.properties.kind.nullable).toBeUndefined();
  });

  it('rejects a node edit that changes nothing, before it can burn a version', async () => {
    // A change-nothing update is not harmless: `updateNode` still bumps the version, writes
    // a node-updated activity, and fails a concurrent writer holding the old version. With
    // one required field per tool the model cannot express it, and validation says so.
    const { store, target, tools } = await fixture();
    for (const id of ['knowledge_rename_node', 'knowledge_set_node_kind']) {
      const outcome = (await tools[id]!.execute?.(
        { node: target.id, expectedVersion: target.version },
        {} as any,
      )) as any;
      expect(outcome?.validationErrors, `${id} accepted an edit with no field to change`).toBeDefined();
    }
    expect(await store.getNode(target.id)).toMatchObject({ version: target.version, name: target.name });
  });

  it('renames and re-kinds a node under CAS', async () => {
    const { target, tools } = await fixture();
    const renamed = (await tools.knowledge_rename_node!.execute?.(
      { node: target.id, expectedVersion: target.version, name: 'Project Atlas Prime' },
      {} as any,
    )) as any;
    expect(renamed).toMatchObject({ name: 'Project Atlas Prime', kind: target.kind, version: 2 });

    const rekinded = (await tools.knowledge_set_node_kind!.execute?.(
      { node: target.id, expectedVersion: renamed.version, kind: 'initiative' },
      {} as any,
    )) as any;
    expect(rekinded).toMatchObject({ name: 'Project Atlas Prime', kind: 'initiative', version: 3 });

    await expect(
      tools.knowledge_rename_node!.execute?.(
        { node: target.id, expectedVersion: target.version, name: 'Stale write' },
        {} as any,
      ),
    ).rejects.toThrow(/version/i);
  });

  it('supports CAS node/content writes and merge tombstones', async () => {
    const { store, source, target, tools } = await fixture();
    const updated = (await tools.knowledge_rename_node!.execute?.(
      { node: target.id, expectedVersion: target.version, name: 'Project Atlas Prime' },
      {} as any,
    )) as any;
    expect(updated).toMatchObject({ name: 'Project Atlas Prime', version: 2 });

    const merged = (await tools.knowledge_merge_nodes!.execute?.(
      { sourceId: source.id, targetId: target.id, sourceVersion: source.version },
      {} as any,
    )) as any;
    expect(merged).toMatchObject({ id: target.id });
    expect(await store.getNode(source.id)).toMatchObject({ mergedInto: target.id });
    expect(await store.resolveNode({ name: source.name, scope })).toMatchObject({ id: target.id });

    const page = (await tools.knowledge_write_node_content!.execute?.(
      { name: 'Atlas brief', content: 'Owned by [[Project Atlas Prime]].', scope: 'resource' },
      {} as any,
    )) as any;
    await expect(
      tools.knowledge_write_node_content!.execute?.(
        { name: page.name, content: 'Missing CAS version.', scope: 'resource' },
        {} as any,
      ),
    ).rejects.toThrow('expectedVersion');
    await expect(
      tools.knowledge_write_node_content!.execute?.(
        { name: 'New node', content: 'Cannot create with a version.', scope: 'resource', expectedVersion: 1 },
        {} as any,
      ),
    ).rejects.toThrow('only valid');
    const revised = (await tools.knowledge_write_node_content!.execute?.(
      { name: page.name, content: 'Launch brief for [[Project Atlas Prime]].', scope: 'resource', expectedVersion: 1 },
      {} as any,
    )) as any;
    expect(revised).toMatchObject({ type: 'node', version: 2 });
    await expect(
      tools.knowledge_write_node_content!.execute?.(
        { name: page.name, content: 'stale', scope: 'resource', expectedVersion: 1 },
        {} as any,
      ),
    ).rejects.toThrow('version');
  });

  it('bounds reserved guidance and never exposes restoration', async () => {
    const { tools } = await fixture();
    await expect(
      tools.knowledge_write_node_content!.execute?.(
        { name: ' Capture-Guidance ', content: 'x'.repeat(4_001), scope: 'resource' },
        {} as any,
      ),
    ).rejects.toThrow('limited');
    expect(Object.keys(tools)).toEqual([
      'knowledge_append',
      'knowledge_remove',
      'knowledge_rename_node',
      'knowledge_set_node_kind',
      'knowledge_merge_nodes',
      'knowledge_rescope',
      'knowledge_write_node_description',
      'knowledge_write_node_content',
    ]);
  });

  it('bounds node descriptions in UTF-16 code units with CAS and explicit clears', async () => {
    const { store, target, tools } = await fixture();
    const write = (description: string, expectedVersion: number) =>
      tools.knowledge_write_node_description!.execute?.({ node: target.id, expectedVersion, description }, {} as any);

    const limit = MAX_KNOWLEDGE_NODE_DESCRIPTION_LENGTH;
    // Exactly at the limit: accepted.
    const atLimit = (await write('x'.repeat(limit), target.version)) as any;
    expect(atLimit).toMatchObject({ id: target.id, version: 2, description: 'x'.repeat(limit) });
    // One over: rejected by schema validation (maxLength counts code points).
    const schemaRejected = (await write('x'.repeat(limit + 1), 2)) as any;
    expect(schemaRejected).toMatchObject({ error: true });
    expect(schemaRejected.message).toContain(String(limit));
    // Astral characters: half as many emoji are half as many code points (schema passes) but exactly
    // `limit` UTF-16 units, which execute accepts.
    const emojiAtLimit = '😀'.repeat(limit / 2);
    expect(emojiAtLimit.length).toBe(limit);
    const astral = (await write(emojiAtLimit, 2)) as any;
    expect(astral).toMatchObject({ version: 3, description: emojiAtLimit });
    // One more emoji still passes the code-point schema but is 2 units over — execute is authoritative.
    await expect(write(`${emojiAtLimit}😀`, 3)).rejects.toThrow(`limited to ${limit}`);
    // Stale CAS rejected.
    await expect(write('stale write', 1)).rejects.toThrow('version');
    // Empty string is an explicit clear.
    const cleared = (await write('', 3)) as any;
    expect(cleared).toMatchObject({ version: 4, description: '' });
    // Content untouched throughout; tool never creates nodes.
    expect((await store.getNode(target.id))?.content).toBe(target.content);
    await expect(
      tools.knowledge_write_node_description!.execute?.(
        { node: 'missing-node', expectedVersion: 1, description: 'nope' },
        {} as any,
      ),
    ).rejects.toThrow('not found');
  });
});
