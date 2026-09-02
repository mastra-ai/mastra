import {
  knowledgeImporterBindingKey,
  knowledgeSemanticDocumentId,
  knowledgeSemanticIdempotencyKey,
  KnowledgeConflictError,
} from '@mastra/core/storage';
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

    it('reveals scope nodes only through direct parent membership', async () => {
      const rootNodes = await store.listNodes({ scopeIds: [ORG_SCOPE_ID], isScope: true });
      expect(rootNodes.map(node => node.id)).toContain(PROJECT_SCOPE_ID);
      expect(rootNodes.map(node => node.id)).not.toContain(ORG_SCOPE_ID);
      await expect(store.resolveNode({ name: 'Acme', scopeIds: [ORG_SCOPE_ID] })).resolves.toBeNull();
    });

    it('hides records whose scope-node owner is not visible through direct membership', async () => {
      await store.createRecord({
        id: 'record-about-org-scope',
        node: ORG_SCOPE_ID,
        text: 'The organization owns this policy.',
        scopeIds: [ORG_SCOPE_ID],
      });

      expect((await store.listRecords({ node: ORG_SCOPE_ID, scopeIds: [ORG_SCOPE_ID] })).records).toEqual([]);
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

    it('shows a record when its owner and any record scope are visible', async () => {
      const node = await store.createNode({ name: 'Shared record owner', scopeIds: [PROJECT_SCOPE_ID] });
      const record = await store.createRecord({
        id: 'record-with-mixed-scopes',
        node,
        text: 'Visible through one direct record membership.',
        scopeIds: [PROJECT_SCOPE_ID, OTHER_SCOPE_ID],
      });

      expect((await store.listRecords({ node, scopeIds: [PROJECT_SCOPE_ID] })).records).toEqual([record]);
      expect((await store.listRecords({ node, scopeIds: [PROJECT_SCOPE_ID, OTHER_SCOPE_ID] })).records).toEqual([
        record,
      ]);
      expect(
        (await store.listSemanticOutbox({ scopeIds: [PROJECT_SCOPE_ID] })).some(
          entry => entry.documentId === knowledgeSemanticDocumentId('record', record.id),
        ),
      ).toBe(true);
    });

    it('does not declassify surviving records when a private mentioned node is permanently removed', async () => {
      const owner = await store.createNode({ name: 'Surviving visible owner', scopeIds: [PROJECT_SCOPE_ID] });
      const secret = await store.createNodeWithAddress({
        source: 'private-import',
        address: 'secret:permanent-target',
        node: { name: 'Permanent private target', scopeIds: [OTHER_SCOPE_ID] },
      });
      const record = await store.createRecord({
        id: 'record-survives-private-target-delete',
        node: owner,
        text: `Still protected by [[${secret.name}]]`,
        scopeIds: [PROJECT_SCOPE_ID],
        resolutionScopeIds: [PROJECT_SCOPE_ID, OTHER_SCOPE_ID],
      });

      expect((await store.listRecords({ node: owner, scopeIds: [PROJECT_SCOPE_ID] })).records).toEqual([]);
      expect(await store.search({ query: 'Still protected', scopeIds: [PROJECT_SCOPE_ID], limit: 10 })).toEqual([]);
      expect(await store.getVisibleRecord({ id: record.id, scopeIds: [PROJECT_SCOPE_ID] })).toBeNull();

      await expect(
        store.deleteNodeByAddress({
          source: 'private-import',
          address: 'secret:permanent-target',
          scopeId: OTHER_SCOPE_ID,
        }),
      ).resolves.toMatchObject({ node: { id: secret.id }, deleted: true });

      expect(await store.getNodeAddress({ source: 'private-import', address: 'secret:permanent-target' })).toBeNull();
      expect((await store.listRecords({ node: owner, scopeIds: [PROJECT_SCOPE_ID] })).records).toEqual([]);
      expect(await store.search({ query: 'Still protected', scopeIds: [PROJECT_SCOPE_ID], limit: 10 })).toEqual([]);
      expect(await store.getVisibleRecord({ id: record.id, scopeIds: [PROJECT_SCOPE_ID] })).toBeNull();
    });

    it('claims semantic changes for one document in order', async () => {
      const node = await store.createNode({ name: 'Ordered semantic subject', scopeIds: [PROJECT_SCOPE_ID] });
      await store.updateNode({ id: node.id, version: node.version, name: 'Updated semantic subject' });
      const documentId = knowledgeSemanticDocumentId('node', node.id);

      const firstClaim = await store.claimSemanticOutbox({
        workerId: 'ordered-worker',
        scopeIds: [PROJECT_SCOPE_ID],
        limit: 100,
      });
      expect(firstClaim.filter(entry => entry.documentId === documentId)).toHaveLength(1);
      await store.completeSemanticOutbox({ ids: firstClaim.map(entry => entry.id), workerId: 'ordered-worker' });

      const secondClaim = await store.claimSemanticOutbox({
        workerId: 'ordered-worker',
        scopeIds: [PROJECT_SCOPE_ID],
        limit: 100,
      });
      expect(secondClaim.filter(entry => entry.documentId === documentId)).toHaveLength(1);
    });

    it('does not reveal permanently deleted records that had mention-protected content', async () => {
      const owner = await store.createNode({ name: 'Visible deletion owner', scopeIds: [PROJECT_SCOPE_ID] });
      const secret = await store.createNode({ name: 'Private deletion target', scopeIds: [OTHER_SCOPE_ID] });
      const record = await store.createRecord({
        id: 'record-private-delete',
        node: owner,
        text: `Sensitive reference [[${secret.name}]]`,
        source: 'private-import',
        scopeIds: [PROJECT_SCOPE_ID],
        resolutionScopeIds: [PROJECT_SCOPE_ID, OTHER_SCOPE_ID],
      });
      const before = await store.listActivity({ scopeIds: [PROJECT_SCOPE_ID], limit: 100 });
      const documentId = knowledgeSemanticDocumentId('record', record.id);
      expect(
        (await store.listSemanticOutbox({ scopeIds: [PROJECT_SCOPE_ID] })).some(
          entry => entry.documentId === documentId,
        ),
      ).toBe(false);
      expect(
        (
          await store.claimSemanticOutbox({ workerId: 'private-worker', scopeIds: [PROJECT_SCOPE_ID], limit: 100 })
        ).some(entry => entry.documentId === documentId),
      ).toBe(false);

      const deleted = await store.deleteRecord({ id: record.id, version: record.version, deletedBy: 'test' });
      expect(await store.listActivity({ scopeIds: [PROJECT_SCOPE_ID], limit: 100 })).toEqual(before);
      expect(
        (await store.listSemanticOutbox({ scopeIds: [PROJECT_SCOPE_ID] })).some(
          entry => entry.documentId === documentId,
        ),
      ).toBe(false);

      await store.deleteRecordBySource({ id: record.id, version: deleted.version, source: 'private-import' });
      expect(await store.listActivity({ scopeIds: [PROJECT_SCOPE_ID], limit: 100 })).toEqual(before);
      expect(
        (await store.listSemanticOutbox({ scopeIds: [PROJECT_SCOPE_ID] })).some(
          entry => entry.documentId === documentId,
        ),
      ).toBe(false);

      const mixed = await store.createRecord({
        id: 'record-mixed-delete',
        node: owner,
        text: 'Mixed-scope deletion',
        source: 'private-import',
        scopeIds: [PROJECT_SCOPE_ID, OTHER_SCOPE_ID],
      });
      await store.deleteRecordBySource({ id: mixed.id, version: mixed.version, source: 'private-import' });
      expect(
        (await store.listActivity({ scopeIds: [PROJECT_SCOPE_ID], limit: 100 })).some(
          event => event.action === 'delete' && event.targetId === mixed.id,
        ),
      ).toBe(true);
      expect(
        (await store.listActivity({ scopeIds: [PROJECT_SCOPE_ID, OTHER_SCOPE_ID], limit: 100 })).some(
          event => event.action === 'delete' && event.targetId === mixed.id,
        ),
      ).toBe(true);
    });

    it('keeps hidden mutations out of visible ordering, pagination, search, and activity', async () => {
      const visible = await store.createNode({ name: 'Visible alpha', scopeIds: [PROJECT_SCOPE_ID] });
      const first = await store.createRecord({
        id: 'record-visible-003',
        node: visible,
        text: 'Needle visible newest',
        scopeIds: [PROJECT_SCOPE_ID],
        contextScopeId: PROJECT_SCOPE_ID,
      });
      await store.createRecord({
        id: 'record-visible-001',
        node: visible,
        text: 'Needle visible oldest',
        scopeIds: [PROJECT_SCOPE_ID],
        contextScopeId: PROJECT_SCOPE_ID,
      });
      const beforeNodes = await store.listNodes({ scopeIds: [PROJECT_SCOPE_ID], namePrefix: 'Visible', limit: 1 });
      const beforeRecords = await store.listRecords({ node: visible, scopeIds: [PROJECT_SCOPE_ID], limit: 1 });
      const beforeSearch = await store.search({ query: 'needle', scopeIds: [PROJECT_SCOPE_ID], limit: 1 });
      const beforeActivity = await store.listActivity({ scopeIds: [PROJECT_SCOPE_ID], limit: 2 });

      const hidden = await store.createNode({ name: 'Visible hidden', scopeIds: [OTHER_SCOPE_ID] });
      await store.createRecord({
        id: 'record-hidden-999',
        node: hidden,
        text: 'Needle hidden',
        scopeIds: [OTHER_SCOPE_ID],
        contextScopeId: OTHER_SCOPE_ID,
      });

      expect(await store.listNodes({ scopeIds: [PROJECT_SCOPE_ID], namePrefix: 'Visible', limit: 1 })).toEqual(
        beforeNodes,
      );
      expect(await store.listRecords({ node: visible, scopeIds: [PROJECT_SCOPE_ID], limit: 1 })).toEqual(beforeRecords);
      expect(beforeRecords).toEqual({ records: [first], nextCursor: first.id });
      expect(await store.search({ query: 'needle', scopeIds: [PROJECT_SCOPE_ID], limit: 1 })).toEqual(beforeSearch);
      expect(await store.listActivity({ scopeIds: [PROJECT_SCOPE_ID], limit: 2 })).toEqual(beforeActivity);
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
      await store.deleteNodeByAddress({ source: 'test', address: 'deleted-parent', scopeId: PROJECT_SCOPE_ID });
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
      await expect(
        store.deleteNodeByAddress({ source: 'github', address: 'scope:team', scopeId: PROJECT_SCOPE_ID }),
      ).rejects.toThrow();
      await expect(store.getNodeAddress({ source: 'github', address: 'scope:team' })).resolves.toMatchObject({
        nodeId: scope.id,
      });

      const configured = await store.reconcileStructure({
        scopes: [{ address: 'configured:team', name: 'Configured' }],
      });
      const configuredId = configured.scopes['configured:team']!;
      await store.setNodeAddress({ source: 'github', address: 'configured:team', nodeId: configuredId });
      await expect(
        store.deleteNodeByAddress({ source: 'github', address: 'configured:team', scopeId: PROJECT_SCOPE_ID }),
      ).rejects.toThrow();
    });

    it('persists recoverable node and empty-scope lifecycle with fenced access changes', async () => {
      const epoch = await store.getAccessEpoch();
      await expect(
        store.upsertScopeGrant(
          { scopeNodeId: PROJECT_SCOPE_ID, scopeRefId: OTHER_SCOPE_ID, role: 'readonly' },
          { expectedAccessEpoch: epoch + 1 },
        ),
      ).rejects.toThrow();
      const shared = await store.upsertScopeGrant(
        { scopeNodeId: PROJECT_SCOPE_ID, scopeRefId: OTHER_SCOPE_ID, role: 'readonly' },
        { expectedAccessEpoch: epoch },
      );
      expect(shared).toEqual({ changed: true, accessEpoch: epoch + 1 });
      await expect(
        store.removeScopeGrant({
          scopeNodeId: PROJECT_SCOPE_ID,
          scopeRefId: OTHER_SCOPE_ID,
          expectedAccessEpoch: epoch,
        }),
      ).rejects.toThrow();
      await expect(
        store.removeScopeGrant({
          scopeNodeId: PROJECT_SCOPE_ID,
          scopeRefId: OTHER_SCOPE_ID,
          expectedAccessEpoch: shared.accessEpoch,
        }),
      ).resolves.toEqual({ changed: true, accessEpoch: shared.accessEpoch + 1 });

      const node = await store.createNode({ name: 'Recoverable node', scopeIds: [PROJECT_SCOPE_ID] });
      const record = await store.createRecord({
        node,
        text: 'Retained through node deletion',
        scopeIds: [PROJECT_SCOPE_ID],
      });
      await store.setNodeAddress({ source: 'recoverable', address: 'node', nodeId: node.id });
      const deleted = await store.deleteNode({ id: node.id, version: node.version, deletedBy: PROJECT_SCOPE_ID });
      expect(await store.getNode(node.id)).toBeNull();
      expect(await store.getNodeIncludingDeleted(node.id)).toMatchObject({ id: node.id, deletedAt: expect.any(Date) });
      expect(await store.getNodeAddress({ source: 'recoverable', address: 'node' })).toBeNull();
      expect(await store.listNodeAddresses({ source: 'recoverable' })).toEqual([]);
      expect(await store.getRecord({ id: record.id })).toMatchObject({ id: record.id, nodeId: node.id });
      await expect(store.createNode({ name: node.name, scopeIds: [PROJECT_SCOPE_ID] })).rejects.toBeInstanceOf(
        KnowledgeConflictError,
      );
      await expect(store.restoreNode({ id: node.id, version: deleted.version })).resolves.toMatchObject({
        id: node.id,
        deletedAt: undefined,
      });
      expect(await store.getNodeAddress({ source: 'recoverable', address: 'node' })).toMatchObject({ nodeId: node.id });

      const childScope = await store.createNode({
        name: 'Recoverable empty scope',
        isScope: true,
        scopeIds: [PROJECT_SCOPE_ID],
      });
      const member = await store.createNode({ name: 'Blocking member', scopeIds: [childScope.id] });
      await expect(
        store.deleteNode({ id: childScope.id, version: childScope.version, deletedBy: PROJECT_SCOPE_ID }),
      ).rejects.toThrow('Knowledge scope is not empty');
      await store.deleteNode({ id: member.id, version: member.version, deletedBy: PROJECT_SCOPE_ID });
      const deletedScope = await store.deleteNode({
        id: childScope.id,
        version: childScope.version,
        deletedBy: PROJECT_SCOPE_ID,
      });
      expect((await store.listScopeGrants()).some(grant => grant.scopeNodeId === childScope.id)).toBe(false);
      await expect(store.restoreNode({ id: childScope.id, version: deletedScope.version })).resolves.toMatchObject({
        id: childScope.id,
        deletedAt: undefined,
      });
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
        await expect(
          store.setRecordScopes({ id: record.id, version: record.version, scopeIds: [invalidScopeId] }),
        ).rejects.toThrow('Knowledge scope not found');
      }

      await expect(store.createRecord({ node: member, text: 'Unstamped', scopeIds: [] })).rejects.toThrow(
        'Knowledge scope not found',
      );
      await expect(store.setRecordScopes({ id: record.id, version: record.version, scopeIds: [] })).rejects.toThrow(
        'Knowledge scope not found',
      );
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

    it('uses monotonic record versions for move and merge semantic events', async () => {
      const source = await store.createNode({ name: 'Semantic source', scopeIds: [PROJECT_SCOPE_ID] });
      const target = await store.createNode({ name: 'Semantic target', scopeIds: [PROJECT_SCOPE_ID] });
      const moved = await store.createRecord({ node: target, text: 'Move scopes', scopeIds: [PROJECT_SCOPE_ID] });
      const merged = await store.createRecord({ node: source, text: 'Merge nodes', scopeIds: [PROJECT_SCOPE_ID] });
      const activityBeforeStaleMove = await store.listActivity({
        scopeIds: [PROJECT_SCOPE_ID, OTHER_SCOPE_ID],
        limit: 100,
      });
      const outboxBeforeStaleMove = await store.listSemanticOutbox({ limit: 100 });

      await expect(
        store.setRecordScopes({ id: moved.id, version: moved.version + 1, scopeIds: [OTHER_SCOPE_ID] }),
      ).rejects.toThrow('version conflict');
      expect(await store.getRecordScopeIds(moved.id)).toEqual([PROJECT_SCOPE_ID]);
      expect(await store.listActivity({ scopeIds: [PROJECT_SCOPE_ID, OTHER_SCOPE_ID], limit: 100 })).toEqual(
        activityBeforeStaleMove,
      );
      expect(await store.listSemanticOutbox({ limit: 100 })).toEqual(outboxBeforeStaleMove);
      await store.setRecordScopes({ id: moved.id, version: moved.version, scopeIds: [OTHER_SCOPE_ID] });
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
      const result = await store.deleteNodeByAddress({
        source: 'github',
        address: 'issue:1',
        scopeId: PROJECT_SCOPE_ID,
      });

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
      expect(await store.listActivity({ scopeIds: [PROJECT_SCOPE_ID] })).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ action: 'delete', targetType: 'record', targetId: record.id }),
          expect.objectContaining({ action: 'delete', targetType: 'node', targetId: node.id }),
        ]),
      );
    });

    it('preserves source-owned records that were broadened outside the importer binding', async () => {
      const node = await store.createNodeWithAddress({
        source: 'github',
        address: 'issue:broadened',
        node: { name: 'Broadened imported issue', scopeIds: [PROJECT_SCOPE_ID] },
      });
      const bindingLocal = await store.createRecord({
        node,
        text: 'Still importer owned',
        source: 'github',
        scopeIds: [PROJECT_SCOPE_ID],
      });
      const broadened = await store.createRecord({
        node,
        text: 'Curated into another scope',
        source: 'github',
        scopeIds: [PROJECT_SCOPE_ID, OTHER_SCOPE_ID],
      });

      const result = await store.deleteNodeByAddress({
        source: 'github',
        address: 'issue:broadened',
        scopeId: PROJECT_SCOPE_ID,
      });

      expect(result.deleted).toBe(false);
      expect(await store.getNode(node.id)).toEqual(node);
      expect(await store.getNodeAddress({ source: 'github', address: 'issue:broadened' })).toBeNull();
      expect(await store.getRecord({ id: bindingLocal.id, includeDeleted: true })).toBeNull();
      expect(await store.getRecord({ id: broadened.id })).toEqual(broadened);
      expect(await store.getRecordScopeIds(broadened.id)).toEqual([PROJECT_SCOPE_ID, OTHER_SCOPE_ID].sort());
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
      await expect(
        store.reconcileStructure(plan, { expectedAbsentScopeAddresses: ['repo:mastra'] }),
      ).rejects.toBeInstanceOf(KnowledgeConflictError);
      expect(await store.getNodeScopeIds(first.scopes['repo:mastra']!)).toEqual([first.scopes['org:shipyard']!]);
    });

    it('reconciles exact scope grants and advances one shared epoch per transaction', async () => {
      const epochBefore = await store.getAccessEpoch();
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
      expect(initial.accessEpoch).toBe(epochBefore + 1);
      expect(await store.getAccessEpoch()).toBe(epochBefore + 1);
      const governedGrants = (await store.listScopeGrants()).filter(
        grant => grant.scopeNodeId === initial.scopes['project:governed'],
      );
      expect(governedGrants).toEqual(
        expect.arrayContaining([
          {
            scopeNodeId: initial.scopes['project:governed'],
            scopeRefId: initial.scopes['principal:one'],
            role: 'readonly',
            canSuggest: true,
          },
          {
            scopeNodeId: initial.scopes['project:governed'],
            scopeRefId: initial.scopes['principal:two'],
            role: 'mirror',
            canSuggest: undefined,
          },
        ]),
      );
      expect(governedGrants).toHaveLength(2);

      const unchanged = await store.reconcileStructure({
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
      expect(unchanged).toMatchObject({ changed: false, accessEpoch: epochBefore + 1 });

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
      expect(changed).toMatchObject({ changed: true, accessEpoch: epochBefore + 2 });
      expect(
        (await store.listScopeGrants()).filter(grant => grant.scopeNodeId === initial.scopes['project:governed']),
      ).toEqual([
        {
          scopeNodeId: initial.scopes['project:governed'],
          scopeRefId: initial.scopes['principal:one'],
          role: 'append',
          canSuggest: true,
        },
      ]);
    });

    it('rejects stale-authority mutations atomically after the access epoch changes', async () => {
      const structure = await store.reconcileStructure({
        scopes: [
          { address: 'principal:stale-writer', name: 'Stale writer' },
          {
            address: 'scope:stale-mutation',
            name: 'Stale mutation scope',
            grants: [{ scopeRefAddress: 'principal:stale-writer', role: 'append' }],
          },
        ],
      });
      const staleEpoch = await store.getAccessEpoch();
      const existingNode = await store.createNode({
        name: 'Existing stale target',
        scopeIds: [structure.scopes['scope:stale-mutation']!],
      });
      await store.setNodeAddress({ source: 'stale-test', address: 'before', nodeId: existingNode.id });
      const beforeActivity = await store.listActivity({
        scopeIds: [structure.scopes['scope:stale-mutation']!],
        limit: 100,
      });
      const beforeOutbox = await store.listSemanticOutbox({ limit: 100 });

      await store.upsertScopeGrant({
        scopeNodeId: structure.scopes['scope:stale-mutation']!,
        scopeRefId: structure.scopes['principal:stale-writer']!,
        role: 'readonly',
      });
      expect(await store.getAccessEpoch()).toBe(staleEpoch + 1);

      await expect(
        store.createNode({
          id: '00000000-0000-4000-8000-000000000099',
          name: 'Must not persist',
          scopeIds: [structure.scopes['scope:stale-mutation']!],
          expectedAccessEpoch: staleEpoch,
        }),
      ).rejects.toThrow('Knowledge access changed during mutation authorization');
      expect(await store.getNode('00000000-0000-4000-8000-000000000099')).toBeNull();
      await expect(
        store.setNodeAddress({
          source: 'stale-test',
          address: 'new',
          nodeId: existingNode.id,
          expectedAccessEpoch: staleEpoch,
        }),
      ).rejects.toThrow('Knowledge access changed during mutation authorization');
      await expect(
        store.rebindNodeAddress({
          source: 'stale-test',
          address: 'before',
          newAddress: 'after',
          nodeId: existingNode.id,
          expectedAccessEpoch: staleEpoch,
        }),
      ).rejects.toThrow('Knowledge access changed during mutation authorization');
      await expect(
        store.removeNodeAddress({
          source: 'stale-test',
          address: 'before',
          nodeId: existingNode.id,
          expectedAccessEpoch: staleEpoch,
        }),
      ).rejects.toThrow('Knowledge access changed during mutation authorization');
      expect(await store.getNodeAddress({ source: 'stale-test', address: 'before' })).toMatchObject({
        nodeId: existingNode.id,
      });
      expect(await store.getNodeAddress({ source: 'stale-test', address: 'new' })).toBeNull();
      expect(await store.getNodeAddress({ source: 'stale-test', address: 'after' })).toBeNull();
      expect(await store.listActivity({ scopeIds: [structure.scopes['scope:stale-mutation']!], limit: 100 })).toEqual(
        beforeActivity,
      );
      expect(await store.listSemanticOutbox({ limit: 100 })).toEqual(beforeOutbox);
    });

    it('rolls back failed structure reconciliation without advancing the access epoch', async () => {
      const epoch = await store.getAccessEpoch();
      const grants = await store.listScopeGrants();
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
      expect(await store.listScopeGrants()).toEqual(grants);
      const retry = await store.reconcileStructure({ scopes: [{ address: 'repo:broken', name: 'Broken' }] });
      expect(retry.createdScopeIds).toHaveLength(1);
    });

    it('persists proposals while keeping hidden targets out of pages and cursors', async () => {
      const visibleNode = await store.createNode({ name: 'Visible proposal target', scopeIds: [PROJECT_SCOPE_ID] });
      const hiddenScope = await store.createNode({
        name: 'Hidden proposal scope',
        isScope: true,
        scopeIds: [ORG_SCOPE_ID],
      });
      const hiddenNode = await store.createNode({ name: 'Hidden proposal target', scopeIds: [hiddenScope.id] });
      const deepHiddenScope = await store.createNode({
        name: 'Deep hidden proposal scope',
        isScope: true,
        scopeIds: [ORG_SCOPE_ID],
      });
      const deepHiddenNode = await store.createNode({
        name: 'Deep hidden proposal target',
        scopeIds: [deepHiddenScope.id],
      });
      const proposalAccessEpoch = await store.getAccessEpoch();
      await expect(
        store.createProposal({
          id: 'empty-target-proposal',
          targets: [],
          operation: 'update-node',
          payload: {},
          proposerContextScopeId: PROJECT_SCOPE_ID,
          expectedAccessEpoch: proposalAccessEpoch,
        }),
      ).rejects.toThrow('A knowledge proposal requires at least one target');

      const visible = await store.createProposal({
        id: 'a-visible-proposal',
        targets: [
          {
            type: 'node',
            id: visibleNode.id,
            expectedVersion: visibleNode.version,
            scopeIds: [PROJECT_SCOPE_ID],
            approvalCapability: 'edit',
          },
        ],
        operation: 'updateNode',
        payload: { name: 'Public edit' },
        reason: 'Correct the title',
        proposerContextScopeId: PROJECT_SCOPE_ID,
        expectedAccessEpoch: proposalAccessEpoch,
      });
      await store.createProposal({
        id: 'z-hidden-proposal',
        targets: [
          {
            type: 'node',
            id: hiddenNode.id,
            expectedVersion: hiddenNode.version,
            scopeIds: [hiddenScope.id],
            approvalCapability: 'edit',
          },
        ],
        operation: 'updateNode',
        payload: { name: 'Private edit' },
        proposerContextScopeId: hiddenScope.id,
        expectedAccessEpoch: proposalAccessEpoch,
      });
      for (let index = 0; index < 1_001; index += 1) {
        await store.createProposal({
          id: `deep-hidden-proposal-${index.toString().padStart(4, '0')}`,
          targets: [
            {
              type: 'node',
              id: deepHiddenNode.id,
              expectedVersion: deepHiddenNode.version,
              scopeIds: [deepHiddenScope.id],
              approvalCapability: 'edit',
            },
          ],
          operation: 'updateNode',
          payload: { name: `Private edit ${index}` },
          proposerContextScopeId: deepHiddenScope.id,
          expectedAccessEpoch: proposalAccessEpoch,
        });
      }
      await store.updateNode({
        id: visibleNode.id,
        version: visibleNode.version,
        scopeIds: [ORG_SCOPE_ID],
      });

      await expect(store.listProposals({ scopeIds: [PROJECT_SCOPE_ID], limit: 1 })).resolves.toEqual({
        proposals: [],
        nextCursor: undefined,
      });
      await expect(
        store.listProposals({ scopeIds: [PROJECT_SCOPE_ID], cursor: 'z-hidden-proposal', limit: 10 }),
      ).resolves.toEqual({ proposals: [] });
      await expect(store.listProposals({ scopeIds: [hiddenScope.id], limit: 10 })).resolves.toEqual({
        proposals: [expect.objectContaining({ id: 'z-hidden-proposal' })],
        nextCursor: undefined,
      });
      await expect(store.listProposals({ scopeIds: [ORG_SCOPE_ID], limit: 10 })).resolves.toEqual({
        proposals: [expect.objectContaining({ id: visible.id })],
        nextCursor: undefined,
      });
      await expect(store.listActivity({ scopeIds: [PROJECT_SCOPE_ID], action: 'propose' })).resolves.toEqual([]);
      await expect(store.listActivity({ scopeIds: [ORG_SCOPE_ID], action: 'propose' })).resolves.toEqual([
        expect.objectContaining({ targetId: visibleNode.id, details: { proposalId: visible.id } }),
      ]);

      const accessEpoch = await store.getAccessEpoch();
      const rejected = await store.reviewProposal({
        id: visible.id,
        status: 'rejected',
        reviewerContextScopeId: PROJECT_SCOPE_ID,
        reviewReason: 'Source contradicts the change',
        expectedAccessEpoch: accessEpoch,
      });
      expect(rejected).toMatchObject({
        status: 'rejected',
        reviewerContextScopeId: PROJECT_SCOPE_ID,
        reviewReason: 'Source contradicts the change',
      });
      await expect(
        store.reviewProposal({
          id: visible.id,
          status: 'rejected',
          reviewerContextScopeId: PROJECT_SCOPE_ID,
          expectedAccessEpoch: accessEpoch,
        }),
      ).rejects.toBeInstanceOf(KnowledgeConflictError);

      const reopened = await createStore();
      await reopened.init();
      await expect(reopened.getProposal(visible.id)).resolves.toEqual(
        expect.objectContaining({
          id: visible.id,
          status: 'rejected',
          targets: visible.targets,
          payload: visible.payload,
          reviewReason: 'Source contradicts the change',
        }),
      );
    });

    it('applies complete proposal mutations atomically and preserves stale proposals for conflict review', async () => {
      const node = await store.createNode({ name: 'Proposal apply target', scopeIds: [PROJECT_SCOPE_ID] });
      const projectScope = await store.getNode(PROJECT_SCOPE_ID);
      const orgScope = await store.getNode(ORG_SCOPE_ID);
      expect(projectScope).not.toBeNull();
      expect(orgScope).not.toBeNull();
      const accessEpoch = await store.getAccessEpoch();
      const proposal = await store.createProposal({
        id: 'proposal-apply',
        targets: [
          {
            type: 'node',
            id: node.id,
            expectedVersion: node.version,
            scopeIds: [PROJECT_SCOPE_ID],
            approvalCapability: 'manageAccess',
          },
          {
            type: 'node',
            id: PROJECT_SCOPE_ID,
            expectedVersion: projectScope!.version,
            scopeIds: [PROJECT_SCOPE_ID],
            approvalCapability: 'manageAccess',
          },
          {
            type: 'node',
            id: ORG_SCOPE_ID,
            expectedVersion: orgScope!.version,
            scopeIds: [ORG_SCOPE_ID],
            approvalCapability: 'manageAccess',
          },
        ],
        operation: 'update-node',
        payload: {
          kind: 'update-node',
          mutation: {
            id: node.id,
            version: node.version,
            name: 'Proposal applied',
            scopeIds: [ORG_SCOPE_ID],
          },
          originalScopeIds: [PROJECT_SCOPE_ID],
        },
        proposerContextScopeId: PROJECT_SCOPE_ID,
        expectedAccessEpoch: accessEpoch,
      });

      await expect(
        store.applyProposal({
          id: proposal.id,
          reviewerContextScopeId: PROJECT_SCOPE_ID,
          expectedAccessEpoch: accessEpoch,
        }),
      ).resolves.toMatchObject({ status: 'approved', reviewerContextScopeId: PROJECT_SCOPE_ID });
      await expect(store.getNode(node.id)).resolves.toMatchObject({
        name: 'Proposal applied',
        version: node.version + 1,
      });
      await expect(store.getNodeScopeIds(node.id)).resolves.toEqual([ORG_SCOPE_ID]);
      await expect(store.listActivity({ scopeIds: [PROJECT_SCOPE_ID, ORG_SCOPE_ID], limit: 100 })).resolves.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ action: 'propose', targetId: node.id }),
          expect.objectContaining({ action: 'approve', targetId: node.id }),
        ]),
      );

      const current = await store.getNode(node.id);
      expect(current).not.toBeNull();
      const stale = await store.createProposal({
        id: 'proposal-stale',
        targets: [
          {
            type: 'node',
            id: node.id,
            expectedVersion: current!.version,
            scopeIds: [ORG_SCOPE_ID],
            approvalCapability: 'edit',
          },
        ],
        operation: 'update-node',
        payload: {
          kind: 'update-node',
          mutation: { id: node.id, version: current!.version, name: 'Must not apply' },
          originalScopeIds: [ORG_SCOPE_ID],
        },
        proposerContextScopeId: PROJECT_SCOPE_ID,
        expectedAccessEpoch: accessEpoch,
      });
      await store.updateNode({ id: node.id, version: current!.version, name: 'Concurrent edit' });
      await expect(
        store.applyProposal({
          id: stale.id,
          reviewerContextScopeId: PROJECT_SCOPE_ID,
          expectedAccessEpoch: accessEpoch,
        }),
      ).resolves.toMatchObject({
        status: 'conflicted',
        reviewReason: `Expected node ${node.id} version ${current!.version}`,
      });
      await expect(store.getProposal(stale.id)).resolves.toMatchObject({ status: 'conflicted' });
      await expect(store.getNode(node.id)).resolves.toMatchObject({ name: 'Concurrent edit' });

      const collisionTarget = await store.createNode({ name: 'Collision target', scopeIds: [PROJECT_SCOPE_ID] });
      const collisionProposal = await store.createProposal({
        id: 'collision-proposal',
        targets: [
          {
            type: 'node',
            id: collisionTarget.id,
            expectedVersion: collisionTarget.version,
            scopeIds: [PROJECT_SCOPE_ID],
            approvalCapability: 'edit',
          },
        ],
        operation: 'update-node',
        payload: {
          kind: 'update-node',
          mutation: { id: collisionTarget.id, version: collisionTarget.version, name: 'Conflicting sibling' },
          originalScopeIds: [PROJECT_SCOPE_ID],
        },
        proposerContextScopeId: PROJECT_SCOPE_ID,
        expectedAccessEpoch: accessEpoch,
      });
      await store.createNode({ name: 'Conflicting sibling', scopeIds: [PROJECT_SCOPE_ID] });
      await expect(
        store.applyProposal({
          id: collisionProposal.id,
          reviewerContextScopeId: PROJECT_SCOPE_ID,
          expectedAccessEpoch: accessEpoch,
        }),
      ).resolves.toMatchObject({
        status: 'conflicted',
        reviewReason: 'Proposed mutation conflicts with current state',
      });
      await expect(store.getNode(collisionTarget.id)).resolves.toMatchObject({ name: 'Collision target' });
    });

    it('persists tuple-scoped importer state, run lifecycle, and activity linkage', async () => {
      const importScopes = await store.reconcileStructure({
        scopes: [
          { address: 'resource:one', name: 'Resource one' },
          { address: 'resource:two', name: 'Resource two' },
        ],
      });
      const firstBinding = knowledgeImporterBindingKey({ source: 'google-calendar:primary', scope: 'resource:one' });
      const secondBinding = knowledgeImporterBindingKey({ source: 'google-calendar:primary', scope: 'resource:two' });
      await store.setImportState({ importerId: 'calendar', binding: firstBinding, key: 'cursor', value: 'cursor-1' });
      await store.setImportState({ importerId: 'calendar', binding: secondBinding, key: 'cursor', value: 'cursor-2' });

      const queuedAt = new Date('2026-08-28T12:00:00.000Z');
      const run = await store.createImportRun({
        id: '01K00000000000000000000001',
        importerId: 'calendar',
        binding: firstBinding,
        importKind: 'static',
        triggerKind: 'programmatic',
        queuedAt,
      });
      await expect(
        store.createImportRun({
          id: run.id,
          importerId: 'calendar',
          binding: firstBinding,
          importKind: 'static',
          triggerKind: 'programmatic',
        }),
      ).rejects.toBeInstanceOf(KnowledgeConflictError);
      await store.updateImportRun({ id: run.id, status: 'running', timestamp: new Date(queuedAt.getTime() + 1_000) });
      const failed = await store.updateImportRun({
        id: run.id,
        status: 'failed',
        error: `Error: calendar unavailable\n${'x'.repeat(2_000)}`,
        traceId: 'trace-1',
        timestamp: new Date(queuedAt.getTime() + 2_000),
      });
      expect(failed).toMatchObject({ status: 'failed', traceId: 'trace-1' });
      expect(failed.error).toHaveLength(1_000);
      expect(failed.error).not.toContain('\n');
      await expect(store.updateImportRun({ id: run.id, status: 'running' })).rejects.toBeInstanceOf(
        KnowledgeConflictError,
      );

      const skipped = await store.createImportRun({
        id: '01K00000000000000000000002',
        importerId: 'calendar',
        binding: firstBinding,
        importKind: 'static',
        triggerKind: 'cron',
        status: 'skipped',
        queuedAt: new Date(queuedAt.getTime() + 3_000),
      });
      expect(skipped.completedAt).toEqual(skipped.queuedAt);
      await expect(
        store.createImportRun({
          importerId: 'calendar',
          binding: firstBinding,
          importKind: 'static',
          triggerKind: 'webhook',
          status: 'skipped',
        }),
      ).rejects.toThrow('Only cron-triggered Knowledge import runs can be created as skipped');

      const interruptedRun = await store.createImportRun({
        id: '01K00000000000000000000003',
        importerId: 'calendar',
        binding: firstBinding,
        importKind: 'static',
        triggerKind: 'programmatic',
        queuedAt: new Date(queuedAt.getTime() + 4_000),
      });
      await store.updateImportRun({ id: interruptedRun.id, status: 'running' });
      const interrupted = await store.updateImportRun({ id: interruptedRun.id, status: 'interrupted' });
      expect(interrupted).toMatchObject({ status: 'interrupted' });

      const node = await store.createNode({
        name: 'Imported calendar event',
        scopeIds: [PROJECT_SCOPE_ID],
        importRunId: run.id,
      });
      expect(await store.listActivity({ scopeIds: [PROJECT_SCOPE_ID], importRunId: run.id })).toEqual([
        expect.objectContaining({ targetId: node.id, importRunId: run.id }),
      ]);

      const reopened = await createStore();
      await reopened.init();
      await expect(
        reopened.getImportState({ importerId: 'calendar', binding: firstBinding, key: 'cursor' }),
      ).resolves.toEqual(expect.objectContaining({ value: 'cursor-1' }));
      await expect(
        reopened.getImportState({ importerId: 'calendar', binding: secondBinding, key: 'cursor' }),
      ).resolves.toEqual(expect.objectContaining({ value: 'cursor-2' }));
      await expect(reopened.getImportRun(run.id)).resolves.toEqual(expect.objectContaining({ status: 'failed' }));
      const firstPage = await reopened.listImportRuns({ importerId: 'calendar', binding: firstBinding, limit: 1 });
      expect(firstPage).toEqual({
        runs: [expect.objectContaining({ id: interrupted.id })],
        nextCursor: interrupted.id,
      });
      await expect(
        reopened.listImportRuns({
          importerIds: ['calendar'],
          scopeIds: [importScopes.scopes['resource:one']!],
          limit: 1,
        }),
      ).resolves.toEqual(firstPage);
      await expect(
        reopened.listImportRuns({
          importerIds: ['other-importer'],
          scopeIds: [importScopes.scopes['resource:one']!],
          limit: 1,
        }),
      ).resolves.toEqual({ runs: [], nextCursor: undefined });
      expect(
        await reopened.listImportRuns({
          importerId: 'calendar',
          binding: firstBinding,
          after: firstPage.nextCursor,
        }),
      ).toEqual({
        runs: [expect.objectContaining({ id: skipped.id }), expect.objectContaining({ id: run.id })],
        nextCursor: undefined,
      });
      await expect(reopened.listImportRuns({ after: 'missing-run-cursor' })).resolves.toEqual({
        runs: [],
        nextCursor: undefined,
      });
    });

    it('serializes importer claims, fences workers, and skips overlapping cron runs atomically', async () => {
      const binding = knowledgeImporterBindingKey({ source: 'calendar:primary', scope: 'project:mastra' });
      const enqueue = (id: string, triggerKind: 'webhook' | 'cron' = 'webhook', inputBinding = binding) =>
        store.enqueueImportRun({
          id,
          importerId: 'runner',
          binding: inputBinding,
          importKind: 'static',
          triggerKind,
          payloadKey: `__mastra_internal/import-payload/${id}`,
          payload: JSON.stringify({ payload: { id } }),
          skipIfActiveCron: triggerKind === 'cron',
        });
      await enqueue('claim-run-1', 'webhook', JSON.stringify([' calendar:primary ', ' project:mastra ']));
      await enqueue('claim-run-2');

      const [firstClaim, secondClaim] = await Promise.all([
        store.claimImportRun({ importerId: 'runner', binding, workerId: 'worker-1', leaseKey: 'lease/' }),
        store.claimImportRun({ importerId: 'runner', binding, workerId: 'worker-2', leaseKey: 'lease/' }),
      ]);
      const claimed = firstClaim ?? secondClaim;
      const owner = firstClaim ? 'worker-1' : 'worker-2';
      const other = firstClaim ? 'worker-2' : 'worker-1';
      expect(claimed).toMatchObject({ id: 'claim-run-1', binding, status: 'running' });
      expect([firstClaim, secondClaim].filter(Boolean)).toHaveLength(1);
      await expect(
        store.heartbeatImportRun({
          id: claimed!.id,
          importerId: 'runner',
          binding,
          workerId: other,
          leaseKey: `lease/${claimed!.id}`,
        }),
      ).resolves.toBe(false);
      await expect(store.getImportRun(claimed!.id)).resolves.not.toMatchObject({
        transcriptThreadId: 'knowledge-import-run:forged',
      });
      await expect(
        store.heartbeatImportRun({
          id: claimed!.id,
          importerId: 'runner',
          binding,
          workerId: owner,
          leaseKey: `lease/${claimed!.id}`,
        }),
      ).resolves.toBe(true);
      await expect(store.getImportRun(claimed!.id)).resolves.toMatchObject({ transcriptThreadId: undefined });
      const foreignBinding = knowledgeImporterBindingKey({ source: 'calendar:secondary', scope: 'project:mastra' });
      await store.enqueueImportRun({
        id: 'foreign-run',
        importerId: 'runner',
        binding: foreignBinding,
        importKind: 'static',
        triggerKind: 'webhook',
        payloadKey: '__mastra_internal/import-payload/foreign-run',
        payload: '{}',
      });
      const foreignRun = await store.claimImportRun({
        importerId: 'runner',
        binding: foreignBinding,
        workerId: 'foreign-worker',
        leaseKey: 'lease/',
      });
      await expect(
        store.heartbeatImportRun({
          id: foreignRun!.id,
          importerId: 'runner',
          binding,
          workerId: owner,
          leaseKey: `lease/${claimed!.id}`,
        }),
      ).resolves.toBe(false);
      await expect(
        store.finalizeImportRun({
          id: foreignRun!.id,
          importerId: 'runner',
          binding,
          workerId: owner,
          leaseKey: `lease/${claimed!.id}`,
          status: 'succeeded',
          state: [],
        }),
      ).resolves.toBeNull();
      await expect(
        store.finalizeImportRun({
          id: foreignRun!.id,
          importerId: 'runner',
          binding: foreignBinding,
          workerId: 'foreign-worker',
          leaseKey: `lease/${foreignRun!.id}`,
          status: 'succeeded',
          state: [],
        }),
      ).resolves.toMatchObject({ status: 'succeeded' });
      await expect(
        store.finalizeImportRun({
          id: claimed!.id,
          importerId: 'runner',
          binding,
          workerId: other,
          leaseKey: `lease/${claimed!.id}`,
          status: 'succeeded',
          state: [{ key: 'cursor', value: 'forged' }],
        }),
      ).resolves.toBeNull();
      await expect(
        store.finalizeImportRun({
          id: claimed!.id,
          importerId: 'runner',
          binding,
          workerId: owner,
          leaseKey: `lease/${claimed!.id}`,
          status: 'succeeded',
          transcriptThreadId: 'knowledge-import-run:claim-run-1',
          state: [{ key: 'cursor', value: 'first' }],
        }),
      ).resolves.toMatchObject({
        status: 'succeeded',
        transcriptThreadId: 'knowledge-import-run:claim-run-1',
      });
      await expect(
        store.claimImportRun({ importerId: 'runner', binding, workerId: other, leaseKey: 'lease/' }),
      ).resolves.toMatchObject({ id: 'claim-run-2', status: 'running' });
      await expect(store.getImportState({ importerId: 'runner', binding, key: 'cursor' })).resolves.toMatchObject({
        value: 'first',
      });

      const cronBinding = knowledgeImporterBindingKey({ source: 'calendar:cron', scope: 'project:mastra' });
      const cronInput = (id: string) => ({
        id,
        importerId: 'cron-runner',
        binding: cronBinding,
        importKind: 'static' as const,
        triggerKind: 'cron' as const,
        payloadKey: `__mastra_internal/import-payload/${id}`,
        payload: '{}',
        skipIfActiveCron: true,
      });
      const cronRuns = await Promise.all([
        store.enqueueImportRun(cronInput('cron-run-1')),
        store.enqueueImportRun(cronInput('cron-run-2')),
      ]);
      expect(cronRuns.map(run => run.status).sort()).toEqual(['queued', 'skipped']);
    });

    it('requeues interrupted work ahead of later same-binding runs', async () => {
      const binding = knowledgeImporterBindingKey({ source: 'calendar:recovery', scope: 'project:mastra' });
      await store.enqueueImportRun({
        id: 'recovery-original',
        importerId: 'recovery-runner',
        binding,
        importKind: 'static',
        triggerKind: 'programmatic',
        payloadKey: 'payload/recovery-original',
        payload: '{"payload":{"window":"first"}}',
        queuedAt: new Date('2020-01-01T00:00:00.000Z'),
      });
      await store.claimImportRun({
        importerId: 'recovery-runner',
        binding,
        workerId: 'dead-worker',
        leaseKey: 'lease/',
        timestamp: new Date('2020-01-01T00:00:01.000Z'),
      });
      await store.enqueueImportRun({
        id: 'aaa-recovery-successor',
        importerId: 'recovery-runner',
        binding,
        importKind: 'static',
        triggerKind: 'webhook',
        payloadKey: 'payload/recovery-successor',
        payload: '{"payload":{"window":"second"}}',
        queuedAt: new Date('2020-01-01T00:00:00.000Z'),
      });

      await expect(
        store.recoverImportRun({
          id: 'recovery-original',
          replacementId: 'zzz-recovery-replacement',
          payloadKey: 'payload/recovery-original',
          replacementPayloadKey: 'payload/recovery-replacement',
          leaseKey: 'lease/recovery-original',
          staleBefore: new Date('2020-01-01T00:00:03.000Z'),
          queuedAt: new Date('2020-01-01T00:00:04.000Z'),
        }),
      ).resolves.toMatchObject({
        id: 'zzz-recovery-replacement',
        queuedAt: new Date('2019-12-31T23:59:59.999Z'),
      });
      await expect(
        store.claimImportRun({ importerId: 'recovery-runner', binding, workerId: 'new-worker', leaseKey: 'lease/' }),
      ).resolves.toMatchObject({ id: 'zzz-recovery-replacement' });
    });

    it('rejects malformed importer bindings', async () => {
      await expect(
        store.setImportState({ importerId: 'calendar', binding: 'ambiguous:binding', key: 'cursor', value: 'one' }),
      ).rejects.toThrow('must encode a [source, scope] tuple');
    });

    it('clears only canonical Knowledge state', async () => {
      const run = await store.createImportRun({
        importerId: 'clear-test',
        binding: knowledgeImporterBindingKey({ source: 'clear-test', scope: 'project:mastra' }),
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
