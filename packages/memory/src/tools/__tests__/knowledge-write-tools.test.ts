import { Knowledge } from '@mastra/core/knowledge';
import { InMemoryStore } from '@mastra/core/storage';
import { GoogleSchemaCompatLayer } from '@mastra/schema-compat';
import { standardSchemaToJSONSchema } from '@mastra/schema-compat/schema';
import { describe, expect, it, vi } from 'vitest';

import { Memory } from '../..';
import {
  createKnowledgeWriteTools,
  MAX_KNOWLEDGE_NODE_DESCRIPTION_LENGTH,
} from '../../processors/observational-memory/subconscious/knowledge-write-tools';

const scopeIds = [
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000003',
];

async function fixture(toolScopeIds = scopeIds) {
  const storage = new InMemoryStore();
  const memory = new Memory({ storage, knowledge: new Knowledge({ id: 'default', storage }) });
  const store = (await memory.storage.getStore('knowledge'))!;
  await store.createNode({ id: scopeIds[0], name: 'Acme', isScope: true, scopeIds: [] });
  await store.createNode({ id: scopeIds[1], name: 'User 42', isScope: true, scopeIds: [scopeIds[0]!] });
  await store.createNode({ id: scopeIds[2], name: 'Thread alpha', isScope: true, scopeIds: [scopeIds[1]!] });
  const source = await store.createNode({ name: 'Atlas Initiative', kind: 'project', scopeIds: [scopeIds[2]!] });
  const target = await store.createNode({ name: 'Project Atlas', kind: 'project', scopeIds: [scopeIds[2]!] });
  const tools = createKnowledgeWriteTools(memory, {
    scopeIds: toolScopeIds,
    sourceThreadId: 'alpha',
  });
  return { store, source, target, tools };
}

describe('Subconscious knowledge write tools', () => {
  it('keeps snapshots of all ten public input schemas', async () => {
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

  it('rejects a rescope changed after visibility validation without overwriting the new scopes', async () => {
    const { store, source, tools } = await fixture();
    const record = await store.createRecord({ node: source, text: 'Private evidence', scopeIds: [scopeIds[2]!] });
    const setScopes = store.setRecordScopes.bind(store);
    const mutation = vi.spyOn(store, 'setRecordScopes').mockImplementationOnce(async input => {
      await setScopes({ id: record.id, version: record.version, scopeIds: [scopeIds[1]!] });
      return setScopes(input);
    });
    await expect(
      tools.knowledge_rescope!.execute?.(
        { recordId: record.id, expectedVersion: record.version, scope: 'org' },
        {} as any,
      ),
    ).rejects.toThrow('version conflict');
    expect(mutation).toHaveBeenCalledWith({ id: record.id, version: record.version, scopeIds: [scopeIds[0]] });
    expect(await store.getRecordScopeIds(record.id)).toEqual([scopeIds[1]]);
    expect(await store.getRecord({ id: record.id })).toMatchObject({ version: record.version + 1 });
    mutation.mockRestore();
  });

  it('creates a node and first record with code-owned provenance and capture time', async () => {
    const { store, tools } = await fixture();
    const before = Date.now();

    const result = (await tools.knowledge_create!.execute?.(
      {
        name: 'Atlas Launch',
        kind: 'project',
        text: 'Project Atlas launches on 2026-09-15.',
        nodeScope: 'resource',
        scope: 'resource',
        when: '2026-09-15T00:00:00.000Z',
      },
      {} as any,
    )) as any;

    expect(result.node).toMatchObject({
      name: 'Atlas Launch',
      kind: 'project',
    });
    expect(result.record).toMatchObject({
      nodeId: result.node.id,
      text: 'Project Atlas launches on 2026-09-15.',
      metadata: { sourceThreadId: 'alpha', when: '2026-09-15T00:00:00.000Z' },
    });
    expect(result.record.createdAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(await store.getNode(result.node.id)).toMatchObject({ name: 'Atlas Launch' });
    expect(await store.getNodeScopeIds(result.node.id)).toEqual([scopeIds[1]]);
    expect(await store.getRecordScopeIds(result.record.id)).toEqual([scopeIds[1]]);
  });

  it('rolls back the node and side effects when the first record fails', async () => {
    const { store, tools } = await fixture([...scopeIds.slice(0, 2), '10000000-0000-4000-8000-000000000099']);
    const before = {
      nodes: await store.listNodes({ scopeIds }),
      activity: await store.listActivity({ scopeIds }),
      outbox: await store.listSemanticOutbox({ scopeIds }),
    };
    await expect(
      tools.knowledge_create!.execute?.(
        { name: 'Partial Atlas', kind: 'project', text: 'This record fails.', nodeScope: 'resource', scope: 'thread' },
        {} as any,
      ),
    ).rejects.toThrow('Knowledge scope not found: 10000000-0000-4000-8000-000000000099');

    expect(await store.resolveNode({ name: 'Partial Atlas', scopeIds })).toBeNull();
    expect({
      nodes: await store.listNodes({ scopeIds }),
      activity: await store.listActivity({ scopeIds }),
      outbox: await store.listSemanticOutbox({ scopeIds }),
    }).toEqual(before);
  });

  it('replaces every curator record beyond the first page and rejects stale replacement', async () => {
    const { store, source, tools } = await fixture();
    const prior = [];
    for (let index = 0; index < 105; index++) {
      prior.push(
        await store.createRecord({ node: source, text: `Prior ${index}`, source: 'subconscious:curate', scopeIds }),
      );
    }
    const unrelated = await store.createRecord({
      node: source,
      text: 'Imported evidence',
      source: 'importer',
      scopeIds,
    });
    await tools.knowledge_write_node_content!.execute?.(
      { name: source.name, content: 'Replacement', expectedVersion: source.version },
      {} as any,
    );
    for (const record of prior) expect(await store.getRecord({ id: record.id })).toBeNull();
    expect(await store.getRecord({ id: unrelated.id })).toMatchObject({ text: 'Imported evidence' });
    const before = await store.listRecordsBySource({ source: 'subconscious:curate', scopeIds, limit: 200 });
    expect(before.records).toHaveLength(1);
    await expect(
      tools.knowledge_write_node_content!.execute?.(
        { name: source.name, content: 'Stale', expectedVersion: source.version },
        {} as any,
      ),
    ).rejects.toThrow();
    expect(await store.listRecordsBySource({ source: 'subconscious:curate', scopeIds, limit: 200 })).toEqual(before);
  });

  it('preserves existing content and all visible side effects when replacement creation fails', async () => {
    const { store, source, tools } = await fixture(['10000000-0000-4000-8000-000000000099', ...scopeIds.slice(1)]);
    await store.createRecord({
      node: source,
      text: 'Original [[Project Atlas]]',
      source: 'subconscious:curate',
      scopeIds: [scopeIds[1]!],
    });
    const snapshot = async () => ({
      node: await store.getNode(source.id),
      records: await store.listRecordsBySource({ source: 'subconscious:curate', scopeIds, includeDeleted: true }),
      activity: await store.listActivity({ scopeIds }),
      outbox: await store.listSemanticOutbox({ scopeIds }),
    });
    const before = await snapshot();
    await expect(
      tools.knowledge_write_node_content!.execute?.(
        { name: source.name, content: 'Replacement', expectedVersion: source.version, scope: 'org' },
        {} as any,
      ),
    ).rejects.toThrow('Knowledge scope not found');
    expect(await snapshot()).toEqual(before);
  });

  it('rejects a non-RFC 3339 `when` at schema validation for create and append, before execute', async () => {
    const { store, source, tools } = await fixture();
    const createNode = vi.spyOn(store, 'createNodeWithRecord');
    const append = vi.spyOn(store, 'createRecord');

    // `format: 'date-time'` alone is a silent no-op under the tool validator's Ajv (no formats
    // plugin), so this proves the schema itself refuses before either tool body runs.
    for (const when of ['next tuesday', '2026-09-15', '2026-09-15 10:00', 'not-a-date']) {
      const created = (await tools.knowledge_create!.execute?.(
        { name: `Bad ${when}`, kind: 'project', text: 'x', when },
        {} as any,
      )) as any;
      expect(created?.error).toBe(true);
      expect(created?.message).toContain('when');

      const appended = (await tools.knowledge_append!.execute?.(
        { node: source.id, text: 'x', when },
        {} as any,
      )) as any;
      expect(appended?.error).toBe(true);
      expect(appended?.message).toContain('when');
    }
    expect(createNode).not.toHaveBeenCalled();
    expect(append).not.toHaveBeenCalled();

    // Valid RFC 3339 values still reach execute and are stamped as real dates.
    const ok = (await tools.knowledge_append!.execute?.(
      { node: source.id, text: 'Landed.', when: '2026-09-15T10:00:00+02:00' },
      {} as any,
    )) as any;
    expect(ok.metadata.when).toEqual('2026-09-15T08:00:00.000Z');
    expect(append).toHaveBeenCalledTimes(1);
  });

  it('ignores forged scope, provenance, timestamp, and version arguments at the tool boundary', async () => {
    // A curator persuaded by an injected observation can only emit arguments the schema allows.
    // Every code-owned field here is either rejected outright (additionalProperties: false) or
    // overwritten by the tool's own scope/provenance/timestamp before storage sees it.
    const { store, source, tools } = await fixture();
    const createNode = vi.spyOn(store, 'createNode');
    const forged = {
      organizationId: 'evil-org',
      sourceThreadId: 'victim-thread',
      capturedAt: '1999-01-01T00:00:00.000Z',
      version: 999,
      maxScope: 'org',
      deletedBy: 'admin',
    };

    for (const [tool, base] of [
      ['knowledge_create', { name: 'Forged', kind: 'project', text: 'x' }],
      ['knowledge_append', { node: source.id, text: 'x' }],
    ] as const) {
      for (const [key, value] of Object.entries(forged)) {
        const result = (await tools[tool]!.execute?.({ ...base, [key]: value }, {} as any)) as any;
        expect({ tool, key, error: result?.error, message: result?.message }).toMatchObject({
          error: true,
          message: expect.stringContaining(key),
        });
      }
    }
    expect(createNode).not.toHaveBeenCalled();

    // Scope selection can only choose from the host-resolved canonical scope IDs.
    for (const tool of ['knowledge_create', 'knowledge_append'] as const) {
      const base =
        tool === 'knowledge_create' ? { name: 'Escalate', kind: 'project', text: 'x' } : { node: source.id, text: 'x' };
      const valid = (await tools[tool]!.execute?.({ ...base, scope: 'org' }, {} as any)) as any;
      expect(await store.getRecordScopeIds((valid.record ?? valid).id)).toEqual([scopeIds[0]]);
      const bogus = (await tools[tool]!.execute?.({ ...base, scope: 'org:evil' }, {} as any)) as any;
      expect(bogus?.error).toBe(true);
    }

    // What actually lands carries the curator's own provenance, never the observation's claims.
    const before = Date.now();
    const appended = (await tools.knowledge_append!.execute?.(
      { node: source.id, text: 'Claims to come from victim-thread in 1999.', scope: 'thread' },
      {} as any,
    )) as any;
    expect(appended).toMatchObject({
      metadata: { sourceThreadId: 'alpha' },
      deletedAt: undefined,
    });
    expect(appended.createdAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('refuses to append to or remove from a node outside the curator’s visible scope', async () => {
    const { store, tools } = await fixture();
    const foreignScope = await store.createNode({ name: 'Other org', isScope: true, scopeIds: [] });
    const foreign = await store.createNode({
      name: 'Other Tenant',
      kind: 'project',
      scopeIds: [foreignScope.id],
    });
    const foreignRecord = await store.createRecord({
      node: foreign.id,
      text: 'private',
      scopeIds: [foreignScope.id],
      source: 'zeta',
      metadata: { sourceThreadId: 'zeta' },
    });
    const append = vi.spyOn(store, 'createRecord');
    const remove = vi.spyOn(store, 'deleteRecord');

    await expect(tools.knowledge_append!.execute?.({ node: foreign.id, text: 'poisoned' }, {} as any)).rejects.toThrow(
      'outside the curator',
    );
    await expect(tools.knowledge_remove!.execute?.({ recordId: foreignRecord.id }, {} as any)).rejects.toThrow(
      'outside the curator',
    );
    expect(append).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(await store.getRecord({ id: foreignRecord.id })).toMatchObject({ text: 'private' });
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

    const update = onTheWire('knowledge_update_node');
    expect(update.anyOf ?? update.oneOf ?? update.allOf).toBeUndefined();
    expect(update.required).toEqual(['node', 'expectedVersion', 'name', 'kind']);
    expect(update.properties.name.type).toBe('string');
    expect(update.properties.kind.type).toBe('string');

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

    // The `when` date-time constraint is enforced locally by Ajv on the raw schema; on the wire the
    // compat layer folds `format`/`pattern` into description text, so Google never sees keywords it
    // might reject and the model still learns the expected shape.
    for (const id of ['knowledge_create', 'knowledge_append']) {
      const when = onTheWire(id).properties.when;
      expect(when.type).toBe('string');
      expect(when.pattern).toBeUndefined();
      expect(when.format).toBeUndefined();
      expect(when.description).toMatch(/date-time/);
    }
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

  it('rejects a combined node edit unless both fields are present', async () => {
    const { store, target, tools } = await fixture();
    const partialCombined = (await tools.knowledge_update_node!.execute?.(
      { node: target.id, expectedVersion: target.version, name: 'Incomplete edit' },
      {} as any,
    )) as any;

    expect(partialCombined?.validationErrors).toBeDefined();
    expect(await store.getNode(target.id)).toMatchObject({ version: target.version, name: target.name });
  });

  it('atomically renames and re-kinds a node under one CAS version', async () => {
    const { store, target, tools } = await fixture();
    const updated = (await tools.knowledge_update_node!.execute?.(
      {
        node: target.id,
        expectedVersion: target.version,
        name: 'Project Atlas Prime',
        kind: 'initiative',
      },
      {} as any,
    )) as any;

    expect(updated).toMatchObject({ name: 'Project Atlas Prime', kind: 'initiative', version: 2 });
    expect(await store.getNode(target.id)).toMatchObject({
      name: 'Project Atlas Prime',
      kind: 'initiative',
      version: 2,
    });

    await expect(
      tools.knowledge_update_node!.execute?.(
        {
          node: target.id,
          expectedVersion: target.version,
          name: 'Stale name',
          kind: 'stale-kind',
        },
        {} as any,
      ),
    ).rejects.toThrow(/version/i);
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
    expect(await store.getNode(source.id)).toBeNull();
    expect(await store.getNodeScopeIds(source.id)).toEqual([]);
    expect(await store.resolveNode({ name: source.name, scopeIds })).toBeNull();

    const page = (await tools.knowledge_write_node_content!.execute?.(
      { name: 'Atlas brief', content: 'Owned by [[Project Atlas Prime]].', scope: 'resource' },
      {} as any,
    )) as any;
    await expect(
      tools.knowledge_write_node_content!.execute?.(
        { name: 'Atlas brief', content: 'Missing CAS version.', scope: 'resource' },
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
      {
        name: 'Atlas brief',
        content: 'Launch brief for [[Project Atlas Prime]].',
        scope: 'resource',
        expectedVersion: 1,
      },
      {} as any,
    )) as any;
    expect(revised).toMatchObject({ nodeId: page.nodeId, text: 'Launch brief for [[Project Atlas Prime]].' });
    expect(await store.getNode(page.nodeId)).toMatchObject({ version: 2 });
    await expect(
      tools.knowledge_write_node_content!.execute?.(
        { name: 'Atlas brief', content: 'stale', scope: 'resource', expectedVersion: 1 },
        {} as any,
      ),
    ).rejects.toThrow('version');
  });

  it('never exposes restoration', async () => {
    const { tools } = await fixture();
    expect(Object.keys(tools)).toEqual([
      'knowledge_create',
      'knowledge_append',
      'knowledge_remove',
      'knowledge_update_node',
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
    expect(atLimit).toMatchObject({ id: target.id, version: 2, metadata: { description: 'x'.repeat(limit) } });
    // One over: rejected by schema validation (maxLength counts code points).
    const schemaRejected = (await write('x'.repeat(limit + 1), 2)) as any;
    expect(schemaRejected).toMatchObject({ error: true });
    expect(schemaRejected.message).toContain(String(limit));
    // Astral characters: half as many emoji are half as many code points (schema passes) but exactly
    // `limit` UTF-16 units, which execute accepts.
    const emojiAtLimit = '😀'.repeat(limit / 2);
    expect(emojiAtLimit.length).toBe(limit);
    const astral = (await write(emojiAtLimit, 2)) as any;
    expect(astral).toMatchObject({ version: 3, metadata: { description: emojiAtLimit } });
    // One more emoji still passes the code-point schema but is 2 units over — execute is authoritative.
    await expect(write(`${emojiAtLimit}😀`, 3)).rejects.toThrow(`limited to ${limit}`);
    // Stale CAS rejected.
    await expect(write('stale write', 1)).rejects.toThrow('version');
    // Empty string is an explicit clear.
    const cleared = (await write('', 3)) as any;
    expect(cleared).toMatchObject({ version: 4, metadata: { description: '' } });
    expect(await store.getNode(target.id)).toMatchObject({ id: target.id, version: 4 });
    await expect(
      tools.knowledge_write_node_description!.execute?.(
        { node: 'missing-node', expectedVersion: 1, description: 'nope' },
        {} as any,
      ),
    ).rejects.toThrow('not found');
  });
});
