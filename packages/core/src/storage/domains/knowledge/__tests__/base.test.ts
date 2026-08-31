import { beforeEach, describe, expect, it } from 'vitest';

import { InMemoryDB } from '../../inmemory-db';
import { InMemoryKnowledgeStorage } from '../inmemory';

const ORG_SCOPE_ID = '10000000-0000-4000-8000-000000000001';
const PROJECT_SCOPE_ID = '10000000-0000-4000-8000-000000000002';
const OTHER_SCOPE_ID = '10000000-0000-4000-8000-000000000003';

describe('InMemoryKnowledgeStorage canonical model', () => {
  let db: InMemoryDB;
  let store: InMemoryKnowledgeStorage;

  beforeEach(async () => {
    db = new InMemoryDB();
    store = new InMemoryKnowledgeStorage({ db });
    await store.init();
    await store.createNode({ id: ORG_SCOPE_ID, name: 'Acme', isScope: true, scopeIds: [] });
    await store.createNode({ id: PROJECT_SCOPE_ID, name: 'Project scope', isScope: true, scopeIds: [ORG_SCOPE_ID] });
    await store.createNode({ id: OTHER_SCOPE_ID, name: 'Other', isScope: true, scopeIds: [] });
  });

  it('reports one canonical storage contract', () => {
    expect(store.getCapabilities()).toEqual({
      supported: true,
      schemaVersion: 1,
      contractVersion: 1,
    });
  });

  it('does not treat a scope node identity as implicit membership', async () => {
    const nodes = await store.listNodes({ scopeIds: [ORG_SCOPE_ID], isScope: true });
    expect(nodes.map(node => node.id)).not.toContain(ORG_SCOPE_ID);
    await expect(store.resolveNode({ name: 'Acme', scopeIds: [ORG_SCOPE_ID] })).resolves.toBeNull();
  });

  it('stores scope membership separately from node payloads', async () => {
    const node = await store.createNode({
      id: '10000000-0000-4000-8000-000000000010',
      name: 'Launch plan',
      kind: 'project',
      metadata: { status: 'active' },
      scopeIds: [PROJECT_SCOPE_ID],
    });

    expect(node).not.toHaveProperty('scope');
    expect(node).not.toHaveProperty('scopes');
    expect(await store.getNodeScopeIds(node.id)).toEqual([PROJECT_SCOPE_ID]);
    expect(await store.getNodeByName({ name: 'Launch plan', scopeIds: [PROJECT_SCOPE_ID] })).toEqual(node);
    expect(await store.getNodeByName({ name: 'Launch plan', scopeIds: [OTHER_SCOPE_ID] })).toBeNull();
  });

  it('stores record membership separately and resolves direct visibility', async () => {
    const node = await store.createNode({ name: 'Policy', scopeIds: [PROJECT_SCOPE_ID] });
    const record = await store.createRecord({
      id: 'record-policy',
      node,
      text: 'Refunds are available within 30 days.',
      metadata: { source: 'handbook' },
      scopeIds: [PROJECT_SCOPE_ID],
    });

    expect(record).toMatchObject({
      id: 'record-policy',
      nodeId: node.id,
      text: 'Refunds are available within 30 days.',
    });
    expect(record).not.toHaveProperty('scope');
    expect(await store.getRecordScopeIds(record.id)).toEqual([PROJECT_SCOPE_ID]);
    expect((await store.listRecords({ node, scopeIds: [PROJECT_SCOPE_ID] })).records).toEqual([record]);
    expect((await store.listRecords({ node, scopeIds: [OTHER_SCOPE_ID] })).records).toEqual([]);
  });

  it('updates node memberships with optimistic concurrency', async () => {
    const node = await store.createNode({ name: 'Movable', scopeIds: [PROJECT_SCOPE_ID] });
    const updated = await store.updateNode({
      id: node.id,
      version: node.version,
      name: 'Moved',
      scopeIds: [OTHER_SCOPE_ID],
    });

    expect(updated.version).toBe(2);
    expect(await store.getNodeScopeIds(node.id)).toEqual([OTHER_SCOPE_ID]);
    await expect(store.updateNode({ id: node.id, version: 1, name: 'Stale' })).rejects.toThrow('version conflict');
  });

  it('creates wikilink mentions without granting membership', async () => {
    const target = await store.createNode({ name: 'Atlas', scopeIds: [PROJECT_SCOPE_ID] });
    const source = await store.createNode({ name: 'Brief', scopeIds: [PROJECT_SCOPE_ID] });
    const record = await store.createRecord({
      node: source,
      text: 'Coordinate with [[Atlas]].',
      scopeIds: [PROJECT_SCOPE_ID],
    });

    expect((await store.listMentioningRecords({ node: target, scopeIds: [PROJECT_SCOPE_ID] })).records).toEqual([
      record,
    ]);
    expect(await store.getNodeScopeIds(target.id)).toEqual([PROJECT_SCOPE_ID]);
  });

  it('resolves a unique visible external address across importer sources', async () => {
    const target = await store.createNode({ name: 'Descriptive pull request title', scopeIds: [ORG_SCOPE_ID] });
    await store.setNodeAddress({ source: 'github:mastra-ai/mastra', address: 'pr:42', nodeId: target.id });
    const source = await store.createNode({ name: 'Decision', scopeIds: [PROJECT_SCOPE_ID] });
    const record = await store.createRecord({
      node: source,
      text: 'Supported by [[pr:42]].',
      source: 'github:mastra-ai/mastra:distiller',
      scopeIds: [PROJECT_SCOPE_ID],
      resolutionScopeIds: [ORG_SCOPE_ID],
    });

    expect(
      (await store.listMentioningRecords({ node: target, scopeIds: [ORG_SCOPE_ID, PROJECT_SCOPE_ID] })).records,
    ).toEqual([record]);
    expect(await store.getNodeByName({ name: 'pr:42', scopeIds: [PROJECT_SCOPE_ID] })).toBeNull();
  });

  it('prefers an exact-source address when another visible source uses the same address', async () => {
    const target = await store.createNode({ name: 'Expected pull request', scopeIds: [ORG_SCOPE_ID] });
    const competing = await store.createNode({ name: 'Unrelated pull request', scopeIds: [OTHER_SCOPE_ID] });
    await store.setNodeAddress({ source: 'github:mastra-ai/mastra', address: 'pr:99', nodeId: target.id });
    await store.setNodeAddress({ source: 'github:other/repo', address: 'pr:99', nodeId: competing.id });
    const source = await store.createNode({ name: 'Source-aware decision', scopeIds: [PROJECT_SCOPE_ID] });
    const record = await store.createRecord({
      node: source,
      text: 'Supported by [[pr:99]].',
      source: 'github:mastra-ai/mastra',
      scopeIds: [PROJECT_SCOPE_ID],
      resolutionScopeIds: [ORG_SCOPE_ID, OTHER_SCOPE_ID],
    });

    expect(
      (
        await store.listMentioningRecords({
          node: target,
          scopeIds: [ORG_SCOPE_ID, PROJECT_SCOPE_ID, OTHER_SCOPE_ID],
        })
      ).records,
    ).toEqual([record]);
    expect(
      (
        await store.listMentioningRecords({
          node: competing,
          scopeIds: [ORG_SCOPE_ID, PROJECT_SCOPE_ID, OTHER_SCOPE_ID],
        })
      ).records,
    ).toEqual([]);
  });

  it('falls back to node names when visible cross-source addresses are ambiguous', async () => {
    const first = await store.createNode({ name: 'First addressed node', scopeIds: [ORG_SCOPE_ID] });
    const second = await store.createNode({ name: 'Second addressed node', scopeIds: [OTHER_SCOPE_ID] });
    const named = await store.createNode({ name: 'pr:100', scopeIds: [PROJECT_SCOPE_ID] });
    await store.setNodeAddress({ source: 'github:first/repo', address: 'pr:100', nodeId: first.id });
    await store.setNodeAddress({ source: 'github:second/repo', address: 'pr:100', nodeId: second.id });
    const source = await store.createNode({ name: 'Ambiguous source decision', scopeIds: [PROJECT_SCOPE_ID] });
    const record = await store.createRecord({
      node: source,
      text: 'Supported by [[pr:100]].',
      source: 'github:distiller',
      scopeIds: [PROJECT_SCOPE_ID],
      resolutionScopeIds: [ORG_SCOPE_ID, PROJECT_SCOPE_ID, OTHER_SCOPE_ID],
    });
    const visibleScopeIds = [ORG_SCOPE_ID, PROJECT_SCOPE_ID, OTHER_SCOPE_ID];

    expect((await store.listMentioningRecords({ node: named, scopeIds: visibleScopeIds })).records).toEqual([record]);
    expect((await store.listMentioningRecords({ node: first, scopeIds: visibleScopeIds })).records).toEqual([]);
    expect((await store.listMentioningRecords({ node: second, scopeIds: visibleScopeIds })).records).toEqual([]);
  });

  it('soft-deletes and restores records without changing membership', async () => {
    const node = await store.createNode({ name: 'Lifecycle', scopeIds: [PROJECT_SCOPE_ID] });
    const record = await store.createRecord({ node, text: 'Version one', scopeIds: [PROJECT_SCOPE_ID] });
    await expect(store.createRecord({ node, text: 'Unstamped', scopeIds: [] })).rejects.toThrow(
      'Knowledge scope not found',
    );
    await expect(store.setRecordScopes({ id: record.id, version: record.version, scopeIds: [] })).rejects.toThrow(
      'Knowledge scope not found',
    );

    await expect(
      store.deleteRecord({ id: record.id, version: record.version + 1, deletedBy: 'curator' }),
    ).rejects.toThrow('version conflict');
    const deleted = await store.deleteRecord({ id: record.id, version: record.version, deletedBy: 'curator' });
    expect(await store.getRecord({ id: record.id })).toBeNull();
    expect(await store.getRecordScopeIds(record.id)).toEqual([PROJECT_SCOPE_ID]);
    await expect(store.restoreRecord({ id: record.id, version: record.version })).rejects.toThrow('version conflict');
    const restored = await store.restoreRecord({ id: record.id, version: deleted.version });
    expect(restored.deletedAt).toBeUndefined();
    expect(restored.version).toBe(3);
  });

  it('merges nodes while retaining records and memberships', async () => {
    const source = await store.createNode({ name: 'Source', scopeIds: [PROJECT_SCOPE_ID] });
    const target = await store.createNode({ name: 'Target', scopeIds: [PROJECT_SCOPE_ID] });
    const record = await store.createRecord({ node: source, text: 'Move me', scopeIds: [PROJECT_SCOPE_ID] });

    await store.mergeNodes({ sourceId: source.id, targetId: target.id, sourceVersion: source.version });
    expect(
      (await store.listRecords({ node: target, scopeIds: [PROJECT_SCOPE_ID] })).records.map(item => item.id),
    ).toEqual([record.id]);
    expect(await store.getNode(source.id)).toBeNull();
    expect(await store.getNodeScopeIds(source.id)).toEqual([]);
  });

  it('searches canonical node and record text within visible memberships', async () => {
    const node = await store.createNode({ name: 'Refund policy', scopeIds: [PROJECT_SCOPE_ID] });
    await store.createRecord({ node, text: 'Atlas refunds settle weekly.', scopeIds: [PROJECT_SCOPE_ID] });

    const results = await store.search({ query: 'refund', scopeIds: [PROJECT_SCOPE_ID] });
    expect(results.map(result => result.type)).toEqual(expect.arrayContaining(['node', 'record']));
    expect(await store.search({ query: 'refund', scopeIds: [OTHER_SCOPE_ID] })).toEqual([]);
  });

  it('rejects address creation and rebinding for deleted nodes', async () => {
    const node = await store.createNode({ name: 'Addressed node', scopeIds: [PROJECT_SCOPE_ID] });
    const target = await store.createNode({ name: 'Merge target', scopeIds: [PROJECT_SCOPE_ID] });
    await store.setNodeAddress({ source: 'test', address: 'before', nodeId: node.id });
    await store.mergeNodes({ sourceId: node.id, targetId: target.id, sourceVersion: node.version });

    await expect(store.setNodeAddress({ source: 'test', address: 'new', nodeId: node.id })).rejects.toThrow(
      'Knowledge node not found',
    );
    await expect(
      store.rebindNodeAddress({ source: 'test', address: 'before', newAddress: 'after', nodeId: node.id }),
    ).rejects.toThrow('Knowledge node not found');
  });

  it('reconciles addressable scope nodes and parent memberships idempotently', async () => {
    const plan = {
      scopes: [
        { address: 'org:shipyard', name: 'Shipyard' },
        {
          address: 'repo:mastra',
          name: 'mastra',
          parentAddresses: ['org:shipyard'],
          grants: [{ scopeRefAddress: 'org:shipyard', role: 'owner' as const }],
        },
      ],
    };

    const first = await store.reconcileStructure(plan);
    const second = await store.reconcileStructure(plan);
    expect(first.createdScopeIds).toHaveLength(2);
    expect(second).toMatchObject({ scopes: first.scopes, createdScopeIds: [], changed: false });
    expect(await store.getNodeScopeIds(first.scopes['repo:mastra']!)).toEqual([first.scopes['org:shipyard']!]);
    expect((await store.getNode(first.scopes['repo:mastra']!))?.isScope).toBe(true);
  });

  it('reconciles exact scope grants and shares access epochs across storage handles', async () => {
    const initial = await store.reconcileStructure({
      scopes: [
        { address: 'principal:one', name: 'Principal one' },
        { address: 'principal:two', name: 'Principal two' },
        {
          address: 'project:governed',
          name: 'Governed',
          grants: [
            { scopeRefAddress: 'principal:one', role: 'readonly', canSuggest: true },
            { scopeRefAddress: 'principal:two', role: 'mirror' },
          ],
        },
      ],
    });
    const secondHandle = new InMemoryKnowledgeStorage({ db });

    expect(initial.accessEpoch).toBe(1);
    expect(await store.getAccessEpoch()).toBe(1);
    expect(await secondHandle.getAccessEpoch()).toBe(1);
    expect(await store.listScopeGrants()).toHaveLength(2);

    const changed = await store.reconcileStructure({
      scopes: [
        { address: 'principal:one', name: 'Principal one' },
        { address: 'principal:two', name: 'Principal two' },
        {
          address: 'project:governed',
          name: 'Governed',
          grants: [{ scopeRefAddress: 'principal:one', role: 'append', canSuggest: true }],
        },
      ],
    });
    expect(changed.accessEpoch).toBe(2);
    expect(await store.listScopeGrants()).toEqual([
      {
        scopeNodeId: initial.scopes['project:governed'],
        scopeRefId: initial.scopes['principal:one'],
        role: 'append',
        canSuggest: true,
      },
    ]);
  });

  it('rolls back failed structure reconciliation without advancing the access epoch', async () => {
    const epoch = await store.getAccessEpoch();
    await expect(
      store.reconcileStructure({
        scopes: [
          {
            address: 'repo:broken',
            name: 'Broken',
            grants: [{ scopeRefAddress: 'org:missing', role: 'owner' }],
          },
        ],
      }),
    ).rejects.toThrow('Knowledge grant scope does not exist');

    expect(await store.getAccessEpoch()).toBe(epoch);
    const retry = await store.reconcileStructure({ scopes: [{ address: 'repo:broken', name: 'Broken' }] });
    expect(retry.createdScopeIds).toHaveLength(1);
  });

  it('clears only canonical Knowledge state', async () => {
    const node = await store.createNode({ name: 'Temporary', scopeIds: [PROJECT_SCOPE_ID] });
    await store.createRecord({ node, text: 'Temporary record', scopeIds: [PROJECT_SCOPE_ID] });
    await store.dangerouslyClearAll();

    expect(await store.getNode(node.id)).toBeNull();
    expect(await store.listSemanticOutbox()).toEqual([]);
    expect(await store.reconcileStructure({ scopes: [{ address: 'org:new', name: 'New' }] })).toMatchObject({
      changed: true,
      accessEpoch: 1,
    });
  });
});
