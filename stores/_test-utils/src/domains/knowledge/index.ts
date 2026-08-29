import { knowledgeSemanticDocumentId, knowledgeSemanticIdempotencyKey } from '@mastra/core/storage';
import type { KnowledgeStorage } from '@mastra/core/storage';
import { beforeEach, describe, expect, it } from 'vitest';

const ORG_SCOPE_ID = '10000000-0000-4000-8000-000000000001';
const PROJECT_SCOPE_ID = '10000000-0000-4000-8000-000000000002';
const OTHER_SCOPE_ID = '10000000-0000-4000-8000-000000000003';
const MISSING_SCOPE_ID = '10000000-0000-4000-8000-000000000099';

export function createKnowledgeStorageTests(createStore: () => Promise<KnowledgeStorage> | KnowledgeStorage): void {
  describe('knowledge storage canonical contract', () => {
    let store: KnowledgeStorage;

    beforeEach(async () => {
      store = await createStore();
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

    it('makes scope nodes visible through their own canonical identity', async () => {
      const nodes = await store.listNodes({ scopeIds: [ORG_SCOPE_ID], isScope: true });
      expect(nodes.map(node => node.id)).toContain(ORG_SCOPE_ID);
      await expect(store.resolveNode({ name: 'Acme', scopeIds: [ORG_SCOPE_ID] })).resolves.toMatchObject({
        id: ORG_SCOPE_ID,
        isScope: true,
      });
    });

    it('makes records about a scope visible through that scope identity', async () => {
      const record = await store.createRecord({
        id: 'record-about-org-scope',
        node: ORG_SCOPE_ID,
        text: 'The organization owns this policy.',
        scopeIds: [ORG_SCOPE_ID],
      });

      expect((await store.listRecords({ node: ORG_SCOPE_ID, scopeIds: [ORG_SCOPE_ID] })).records).toEqual([record]);
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

    it('hides records unless their owner and every mention target are visible', async () => {
      const source = await store.createNode({ name: 'Public brief', scopeIds: [PROJECT_SCOPE_ID] });
      const secret = await store.createNode({ name: 'Private target', scopeIds: [OTHER_SCOPE_ID] });
      const record = await store.createRecord({
        id: 'record-cross-scope-mention',
        node: source,
        text: 'References [[Private target]] and contains cobalt.',
        source: 'cross-scope',
        scopeIds: [PROJECT_SCOPE_ID],
        resolutionScopeIds: [OTHER_SCOPE_ID],
        contextScopeId: PROJECT_SCOPE_ID,
      });

      expect((await store.listRecords({ node: source, scopeIds: [PROJECT_SCOPE_ID] })).records).toEqual([]);
      expect((await store.listMentioningRecords({ node: secret, scopeIds: [PROJECT_SCOPE_ID] })).records).toEqual([]);
      expect((await store.listRelatedRecords({ node: source, scopeIds: [PROJECT_SCOPE_ID] })).records).toEqual([]);
      expect(
        (await store.listRecordsBySource({ source: 'cross-scope', scopeIds: [PROJECT_SCOPE_ID] })).records,
      ).toEqual([]);
      expect(await store.search({ query: 'cobalt', scopeIds: [PROJECT_SCOPE_ID] })).toEqual([]);
      expect(
        (await store.listActivity({ scopeIds: [PROJECT_SCOPE_ID] })).some(event => event.targetId === record.id),
      ).toBe(false);
    });

    it('rejects records attached to deleted nodes', async () => {
      const node = await store.createNode({ name: 'Deleted parent', scopeIds: [PROJECT_SCOPE_ID] });
      await store.setNodeAddress({ source: 'test', address: 'deleted-parent', nodeId: node.id });
      await store.deleteNodeByAddress({ source: 'test', address: 'deleted-parent' });
      await expect(
        store.createRecord({ node, text: 'Must not persist', scopeIds: [PROJECT_SCOPE_ID] }),
      ).rejects.toThrow('Knowledge node not found');
    });

    it('lists source records oldest-first and advances after a cursor', async () => {
      const node = await store.createNode({ name: 'Source cursor', scopeIds: [PROJECT_SCOPE_ID] });
      const first = await store.createRecord({
        id: 'record-source-001',
        node,
        text: 'First',
        source: 'thread-alpha',
        scopeIds: [PROJECT_SCOPE_ID],
      });
      const second = await store.createRecord({
        id: 'record-source-002',
        node,
        text: 'Second',
        source: 'thread-alpha',
        scopeIds: [PROJECT_SCOPE_ID],
      });

      expect(
        (await store.listRecordsBySource({ source: 'thread-alpha', scopeIds: [PROJECT_SCOPE_ID] })).records.map(
          record => record.id,
        ),
      ).toEqual([first.id, second.id]);
      expect(
        (
          await store.listRecordsBySource({ source: 'thread-alpha', scopeIds: [PROJECT_SCOPE_ID], after: first.id })
        ).records.map(record => record.id),
      ).toEqual([second.id]);
    });

    it('deduplicates concurrent node creation by canonical name and memberships', async () => {
      const [first, second] = await Promise.all([
        store.createNode({ name: 'Concurrent Topic', scopeIds: [PROJECT_SCOPE_ID] }),
        store.createNode({ name: ' concurrent topic ', scopeIds: [PROJECT_SCOPE_ID] }),
      ]);

      expect(second.id).toBe(first.id);
      const matches = await store.listNodes({ scopeIds: [PROJECT_SCOPE_ID], namePrefix: 'concurrent topic' });
      expect(matches.filter(node => node.name.toLowerCase() === 'concurrent topic')).toHaveLength(1);
    });

    it('rejects duplicate sibling names when memberships overlap', async () => {
      const existing = await store.createNode({ name: 'Shared topic', scopeIds: [PROJECT_SCOPE_ID] });

      await expect(
        store.createNode({ name: ' shared topic ', scopeIds: [PROJECT_SCOPE_ID, OTHER_SCOPE_ID] }),
      ).rejects.toThrow();

      const movable = await store.createNode({ name: 'Movable sibling', scopeIds: [OTHER_SCOPE_ID] });
      await expect(
        store.updateNode({
          id: movable.id,
          version: movable.version,
          name: existing.name,
          scopeIds: [PROJECT_SCOPE_ID, OTHER_SCOPE_ID],
        }),
      ).rejects.toThrow();
    });

    it('serializes concurrent sibling collisions across overlapping memberships', async () => {
      const createResults = await Promise.allSettled([
        store.createNode({ name: 'Concurrent overlap', scopeIds: [PROJECT_SCOPE_ID] }),
        store.createNode({ name: ' concurrent overlap ', scopeIds: [PROJECT_SCOPE_ID, OTHER_SCOPE_ID] }),
      ]);
      expect(createResults.map(result => result.status).sort()).toEqual(['fulfilled', 'rejected']);

      const first = await store.createNode({ name: 'Rename first', scopeIds: [PROJECT_SCOPE_ID] });
      const second = await store.createNode({ name: 'Rename second', scopeIds: [OTHER_SCOPE_ID] });
      const updateResults = await Promise.allSettled([
        store.updateNode({ id: first.id, version: first.version, name: 'Concurrent rename' }),
        store.updateNode({
          id: second.id,
          version: second.version,
          name: ' concurrent rename ',
          scopeIds: [PROJECT_SCOPE_ID, OTHER_SCOPE_ID],
        }),
      ]);
      expect(updateResults.map(result => result.status).sort()).toEqual(['fulfilled', 'rejected']);
    });

    it('rejects scope demotion and source deletion while dependents remain', async () => {
      const scope = await store.createNodeWithAddress({
        source: 'github',
        address: 'scope:team',
        node: { name: 'Team scope', isScope: true, scopeIds: [ORG_SCOPE_ID] },
      });
      await store.createNode({ name: 'Team child', scopeIds: [scope.id] });
      const recordNode = await store.createNode({ name: 'Team record subject', scopeIds: [PROJECT_SCOPE_ID] });
      await store.createRecord({ node: recordNode, text: 'Team record', scopeIds: [scope.id] });

      await expect(store.updateNode({ id: scope.id, version: scope.version, isScope: false })).rejects.toThrow();
      await expect(store.deleteNodeByAddress({ source: 'github', address: 'scope:team' })).rejects.toThrow();
      await expect(store.getNodeAddress({ source: 'github', address: 'scope:team' })).resolves.toMatchObject({
        nodeId: scope.id,
      });

      const configured = await store.reconcileStructure({
        scopes: [{ address: 'configured:team', name: 'Configured' }],
      });
      const configuredId = configured.scopes['configured:team']!;
      await store.setNodeAddress({ source: 'github', address: 'configured:team', nodeId: configuredId });
      await expect(store.deleteNodeByAddress({ source: 'github', address: 'configured:team' })).rejects.toThrow();
    });

    it('accepts memberships only to live scope nodes', async () => {
      const ordinary = await store.createNode({ name: 'Ordinary', scopeIds: [PROJECT_SCOPE_ID] });
      const member = await store.createNode({ name: 'Member', scopeIds: [PROJECT_SCOPE_ID] });
      const record = await store.createRecord({ node: member, text: 'Scoped record', scopeIds: [PROJECT_SCOPE_ID] });

      for (const invalidScopeId of [MISSING_SCOPE_ID, ordinary.id]) {
        await expect(
          store.createNode({ name: `Invalid ${invalidScopeId}`, scopeIds: [invalidScopeId] }),
        ).rejects.toThrow('Knowledge scope not found');
        await expect(
          store.updateNode({ id: member.id, version: member.version, scopeIds: [invalidScopeId] }),
        ).rejects.toThrow('Knowledge scope not found');
        await expect(store.createRecord({ node: member, text: 'Invalid', scopeIds: [invalidScopeId] })).rejects.toThrow(
          'Knowledge scope not found',
        );
        await expect(
          store.createRecord({
            node: member,
            text: 'Invalid resolution',
            scopeIds: [PROJECT_SCOPE_ID],
            resolutionScopeIds: [invalidScopeId],
          }),
        ).rejects.toThrow('Knowledge scope not found');
        await expect(store.setRecordScopes({ id: record.id, scopeIds: [invalidScopeId] })).rejects.toThrow(
          'Knowledge scope not found',
        );
      }
    });

    it('updates node memberships with optimistic concurrency and refreshes record semantics', async () => {
      const node = await store.createNode({ name: 'Movable', scopeIds: [PROJECT_SCOPE_ID] });
      const record = await store.createRecord({ node, text: 'Attached record', scopeIds: [PROJECT_SCOPE_ID] });
      const updated = await store.updateNode({
        id: node.id,
        version: node.version,
        name: 'Moved',
        scopeIds: [OTHER_SCOPE_ID],
      });

      expect(updated.version).toBe(2);
      expect(await store.getNodeScopeIds(node.id)).toEqual([OTHER_SCOPE_ID]);
      expect((await store.getRecord({ id: record.id }))?.version).toBe(2);
      expect((await store.listSemanticOutbox()).map(entry => entry.idempotencyKey)).toEqual(
        expect.arrayContaining([
          knowledgeSemanticIdempotencyKey(knowledgeSemanticDocumentId('node', node.id), 'delete', 2),
          knowledgeSemanticIdempotencyKey(knowledgeSemanticDocumentId('node', node.id), 'upsert', 2),
          knowledgeSemanticIdempotencyKey(knowledgeSemanticDocumentId('record', record.id), 'upsert', 2),
        ]),
      );
      await expect(store.updateNode({ id: node.id, version: 1, name: 'Stale' })).rejects.toThrow('version conflict');

      const collision = await store.createNode({ name: 'Collision', scopeIds: [PROJECT_SCOPE_ID] });
      await expect(
        store.updateNode({
          id: collision.id,
          version: collision.version,
          name: updated.name,
          scopeIds: [OTHER_SCOPE_ID],
        }),
      ).rejects.toThrow('version conflict');
    });

    it('resolves wikilinks through separate resolution scopes without granting membership', async () => {
      const target = await store.createNode({ name: 'Atlas', scopeIds: [ORG_SCOPE_ID] });
      const source = await store.createNode({ name: 'Brief', scopeIds: [PROJECT_SCOPE_ID] });
      const record = await store.createRecord({
        node: source,
        text: 'Coordinate with [[Atlas]] and [[Local contact]].',
        scopeIds: [PROJECT_SCOPE_ID],
        resolutionScopeIds: [ORG_SCOPE_ID],
      });

      expect((await store.listMentioningRecords({ node: target, scopeIds: [PROJECT_SCOPE_ID] })).records).toEqual([]);
      expect(
        (await store.listMentioningRecords({ node: target, scopeIds: [ORG_SCOPE_ID, PROJECT_SCOPE_ID] })).records,
      ).toEqual([record]);
      expect(await store.getNodeScopeIds(target.id)).toEqual([ORG_SCOPE_ID]);
      const unresolved = await store.getNodeByName({ name: 'Local contact', scopeIds: [PROJECT_SCOPE_ID] });
      expect(unresolved).not.toBeNull();
      expect(await store.getNodeScopeIds(unresolved!.id)).toEqual([PROJECT_SCOPE_ID]);
    });

    it('soft-deletes and restores records without changing membership', async () => {
      const node = await store.createNode({ name: 'Lifecycle', scopeIds: [PROJECT_SCOPE_ID] });
      const record = await store.createRecord({ node, text: 'Version one', scopeIds: [PROJECT_SCOPE_ID] });

      await store.deleteRecord({ id: record.id, deletedBy: 'curator' });
      expect(await store.getRecord({ id: record.id })).toBeNull();
      expect(await store.getRecordScopeIds(record.id)).toEqual([PROJECT_SCOPE_ID]);
      const restored = await store.restoreRecord({ id: record.id });
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

    it('uses monotonic record versions for move and merge semantic events', async () => {
      const source = await store.createNode({ name: 'Semantic source', scopeIds: [PROJECT_SCOPE_ID] });
      const target = await store.createNode({ name: 'Semantic target', scopeIds: [PROJECT_SCOPE_ID] });
      const moved = await store.createRecord({ node: target, text: 'Move scopes', scopeIds: [PROJECT_SCOPE_ID] });
      const merged = await store.createRecord({ node: source, text: 'Merge nodes', scopeIds: [PROJECT_SCOPE_ID] });

      await store.setRecordScopes({ id: moved.id, scopeIds: [OTHER_SCOPE_ID] });
      await store.mergeNodes({ sourceId: source.id, targetId: target.id, sourceVersion: source.version });

      const keys = (await store.listSemanticOutbox()).map(entry => entry.idempotencyKey);
      const movedDocumentId = knowledgeSemanticDocumentId('record', moved.id);
      const mergedDocumentId = knowledgeSemanticDocumentId('record', merged.id);
      expect(keys).toEqual(
        expect.arrayContaining([
          knowledgeSemanticIdempotencyKey(movedDocumentId, 'delete', 2),
          knowledgeSemanticIdempotencyKey(movedDocumentId, 'upsert', 2),
          knowledgeSemanticIdempotencyKey(mergedDocumentId, 'upsert', 2),
        ]),
      );
    });

    it('keeps source-owned permanent deletion free of dangling memberships and addresses', async () => {
      await expect(
        store.setNodeAddress({ source: 'github', address: 'missing', nodeId: 'missing-node' }),
      ).rejects.toThrow();

      const node = await store.createNodeWithAddress({
        source: 'github',
        address: 'issue:1',
        node: { name: 'Imported issue', scopeIds: [PROJECT_SCOPE_ID] },
      });
      const record = await store.createRecord({
        node,
        text: 'Imported body',
        source: 'github',
        scopeIds: [PROJECT_SCOPE_ID],
      });
      const result = await store.deleteNodeByAddress({ source: 'github', address: 'issue:1' });

      expect(result.deleted).toBe(true);
      expect(await store.getNode(node.id)).toBeNull();
      expect(await store.getNodeScopeIds(node.id)).toEqual([]);
      expect(await store.getRecord({ id: record.id, includeDeleted: true })).toBeNull();
      expect(await store.getRecordScopeIds(record.id)).toEqual([]);
      expect((await store.listSemanticOutbox()).map(entry => entry.idempotencyKey)).toEqual(
        expect.arrayContaining([
          knowledgeSemanticIdempotencyKey(knowledgeSemanticDocumentId('record', record.id), 'delete', 2),
          knowledgeSemanticIdempotencyKey(knowledgeSemanticDocumentId('node', node.id), 'delete', 2),
        ]),
      );
    });

    it('searches canonical node and record text within visible memberships', async () => {
      const node = await store.createNode({ name: 'Refund policy', scopeIds: [PROJECT_SCOPE_ID] });
      await store.createRecord({ node, text: 'Atlas refunds settle weekly.', scopeIds: [PROJECT_SCOPE_ID] });

      const results = await store.search({ query: 'refund', scopeIds: [PROJECT_SCOPE_ID] });
      expect(results.map(result => result.type)).toEqual(expect.arrayContaining(['node', 'record']));
      expect(await store.search({ query: 'refund', scopeIds: [OTHER_SCOPE_ID] })).toEqual([]);
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
      expect(await store.getScopeAddress('repo:mastra')).toEqual({
        address: 'repo:mastra',
        scopeNodeId: first.scopes['repo:mastra'],
      });
      expect(await store.getScopeAddress('repo:missing')).toBeNull();
      expect((await store.getNode(first.scopes['repo:mastra']!))?.isScope).toBe(true);
    });

    it('rolls back failed structure reconciliation', async () => {
      await expect(
        store.reconcileStructure({
          scopes: [{ address: 'repo:broken', name: 'Broken', parentAddresses: ['org:missing'] }],
        }),
      ).rejects.toThrow('Knowledge parent scope does not exist');

      const retry = await store.reconcileStructure({ scopes: [{ address: 'repo:broken', name: 'Broken' }] });
      expect(retry.createdScopeIds).toHaveLength(1);
    });

    it('clears only canonical Knowledge state', async () => {
      const run = await store.createImportRun({
        importerId: 'clear-test',
        binding: 'project',
        importKind: 'static',
        triggerKind: 'programmatic',
      });
      const node = await store.createNode({
        name: 'Temporary',
        scopeIds: [PROJECT_SCOPE_ID],
        importRunId: run.id,
      });
      await store.createRecord({
        node,
        text: 'Temporary record',
        scopeIds: [PROJECT_SCOPE_ID],
        importRunId: run.id,
      });
      await store.dangerouslyClearAll();

      expect(await store.getNode(node.id)).toBeNull();
      expect(await store.listSemanticOutbox()).toEqual([]);
      expect(await store.reconcileStructure({ scopes: [{ address: 'org:new', name: 'New' }] })).toMatchObject({
        changed: true,
        accessEpoch: 1,
      });
    });
  });
}
