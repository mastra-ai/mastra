import type { KnowledgeStorage, KnowledgeStructurePlan } from '@mastra/core/storage';
import {
  KnowledgeConflictError,
  KnowledgeSchemaResetRequiredError,
  MAX_KNOWLEDGE_NODE_DESCRIPTION_LENGTH,
  MAX_KNOWLEDGE_RECORD_TEXT_LENGTH,
} from '@mastra/core/storage';
import { beforeEach, describe, expect, it } from 'vitest';

export interface KnowledgeSchemaResetFixture {
  store: KnowledgeStorage;
  snapshot: () => Promise<unknown>;
  assertResetResult: () => Promise<void>;
  cleanup: () => Promise<void>;
}

export function createKnowledgeSchemaResetTests(createFixture: () => Promise<KnowledgeSchemaResetFixture>): void {
  describe('knowledge schema reset contract', () => {
    it('rejects an incompatible schema without mutation until explicitly reset', async () => {
      const fixture = await createFixture();
      try {
        const before = await fixture.snapshot();
        expect(await fixture.store.inspectSchema()).toMatchObject({ status: 'incompatible-reset-required' });

        await expect(fixture.store.init()).rejects.toBeInstanceOf(KnowledgeSchemaResetRequiredError);
        expect(await fixture.snapshot()).toEqual(before);

        await fixture.store.dangerouslyReset();
        expect(await fixture.store.inspectSchema()).toEqual({ status: 'compatible', schemaVersion: 2 });
        await fixture.assertResetResult();
      } finally {
        await fixture.cleanup();
      }
    });
  });
}

const resource = ['org:acme', 'resource:mastra'];
const thread = [...resource, 'thread:t1'];

const STRUCTURE_PLAN: KnowledgeStructurePlan = {
  scopes: [
    { address: 'org:acme', name: 'acme' },
    { address: 'features', name: 'features', parentAddresses: ['org:acme'] },
  ],
};

function isUnsupportedStructure(error: unknown): boolean {
  return error instanceof Error && error.name === 'KnowledgeUnsupportedCapabilityError';
}

export function createKnowledgeStorageTests(createStore: () => Promise<KnowledgeStorage> | KnowledgeStorage): void {
  describe('knowledge storage contract', () => {
    let store: KnowledgeStorage;

    beforeEach(async () => {
      store = await createStore();
      await store.init();
      await store.dangerouslyClearAll();
    });

    it('filters scope nodes to one subtree or exact addresses and pages them by name', async () => {
      let ids: Record<string, string>;
      try {
        ({ scopes: ids } = await store.reconcileStructure({
          scopes: [
            { address: 'org:acme', name: 'Acme' },
            { address: 'team:a', name: 'A', parentAddresses: ['org:acme'] },
            { address: 'team:b', name: 'B', parentAddresses: ['org:acme'] },
            { address: 'project:p', name: 'P', parentAddresses: ['team:a', 'team:b'] },
            { address: 'org:other', name: 'Other' },
            { address: 'team:o', name: 'O', parentAddresses: ['org:other'] },
          ],
        }));
      } catch (error) {
        const unsupported =
          error instanceof Error &&
          (error.name === 'KnowledgeUnsupportedCapabilityError' ||
            /does not support structured reconciliation/.test(error.message));
        if (unsupported) return;
        throw error;
      }

      const within = await store.listScopeNodes({ withinAddress: 'org:acme' });
      expect(within.scopes.map(scope => scope.address)).toEqual(['team:a', 'org:acme', 'team:b', 'project:p']);
      expect(within.nextCursor).toBeNull();
      // Parent ids come back in a stable order so pages of the same query compare equal.
      expect(within.scopes.find(scope => scope.address === 'project:p')?.parentIds).toEqual(
        [ids['team:a'], ids['team:b']].sort(),
      );

      expect(await store.listScopeNodes({ withinAddress: 'org:acme', limit: Number.NaN })).toEqual(within);
      const first = await store.listScopeNodes({ withinAddress: 'org:acme', limit: 3 });
      expect(first.scopes).toHaveLength(3);
      expect(first.nextCursor).toEqual(expect.any(String));
      const second = await store.listScopeNodes({ withinAddress: 'org:acme', limit: 3, cursor: first.nextCursor! });
      expect([...first.scopes, ...second.scopes]).toEqual(within.scopes);
      expect(second.nextCursor).toBeNull();
      await expect(store.listScopeNodes({ withinAddress: 'org:other', cursor: first.nextCursor! })).rejects.toThrow(
        'does not match this query',
      );

      expect((await store.listScopeNodes({ withinAddress: 'team:b' })).scopes.map(scope => scope.address)).toEqual([
        'team:b',
        'project:p',
      ]);
      expect((await store.listScopeNodes({ addresses: ['team:o', 'missing'] })).scopes.map(scope => scope.id)).toEqual([
        ids['team:o'],
      ]);
      expect(await store.listScopeNodes({ withinAddress: 'missing' })).toEqual({ scopes: [], nextCursor: null });

      // An id filter inside a subtree answers "is this scope in that subtree?" with one bounded read.
      expect(
        (await store.listScopeNodes({ withinAddress: 'org:acme', ids: [ids['project:p']!], limit: 1 })).scopes.map(
          scope => scope.address,
        ),
      ).toEqual(['project:p']);
      expect(await store.listScopeNodes({ withinAddress: 'org:acme', ids: [ids['team:o']!] })).toEqual({
        scopes: [],
        nextCursor: null,
      });
      expect(await store.listScopeNodes({ ids: [] })).toEqual({ scopes: [], nextCursor: null });
    });

    it('adds newly declared parent edges and grants to existing static scopes, but never to materialized ones', async () => {
      const org = { address: 'org:acme', name: 'Acme' };
      const other = { address: 'org:other', name: 'Other' };
      let first;
      try {
        first = await store.reconcileStructure({ scopes: [org, other, { address: 'team', name: 'Team' }] });
      } catch (error) {
        const unsupported =
          error instanceof Error &&
          (error.name === 'KnowledgeUnsupportedCapabilityError' ||
            /does not support structured reconciliation/.test(error.message));
        if (unsupported) return;
        throw error;
      }
      const teamParents = async () => (await store.listScopeNodes({ addresses: ['team'] })).scopes[0]?.parentIds ?? [];

      const withParent = await store.reconcileStructure({
        scopes: [org, other, { address: 'team', name: 'Team', parentAddresses: ['org:acme'] }],
      });
      expect(withParent).toMatchObject({ changed: true, accessEpoch: first.accessEpoch + 1, createdScopeIds: [] });
      expect(await teamParents()).toEqual([first.scopes['org:acme']]);

      const teamWithGrant = {
        address: 'team',
        name: 'Team',
        parentAddresses: ['org:acme'],
        grants: [{ scopeRefAddress: 'org:acme', role: 'readonly' as const }],
      };
      const withGrant = await store.reconcileStructure({ scopes: [org, other, teamWithGrant] });
      expect(withGrant).toMatchObject({ changed: true, accessEpoch: withParent.accessEpoch + 1 });
      await expect(store.reconcileStructure({ scopes: [org, other, teamWithGrant] })).resolves.toMatchObject({
        changed: false,
        accessEpoch: withGrant.accessEpoch,
      });

      // Materialization plans keep a scope as it was created, even when its template changes.
      await expect(
        store.reconcileStructure({
          scopes: [
            {
              ...teamWithGrant,
              parentAddresses: ['org:acme', 'org:other'],
              grants: [...teamWithGrant.grants, { scopeRefAddress: 'org:other', role: 'readonly' }],
            },
          ],
          retrofit: false,
        }),
      ).resolves.toMatchObject({ changed: false, accessEpoch: withGrant.accessEpoch });
      expect(await teamParents()).toEqual([first.scopes['org:acme']]);
    });

    it('lets content nodes share a scope name without blocking reconciliation', async () => {
      const org = { address: 'org:acme', name: 'Acme' };
      const team = { address: 'team', name: 'Team', parentAddresses: ['org:acme'] };
      try {
        await store.reconcileStructure({ scopes: [org] });
      } catch (error) {
        const unsupported =
          error instanceof Error &&
          (error.name === 'KnowledgeUnsupportedCapabilityError' ||
            /does not support structured reconciliation/.test(error.message));
        if (unsupported) return;
        throw error;
      }
      await store.createNode({ name: 'Team', kind: 'topic', scope: ['org:acme'] });

      await expect(store.reconcileStructure({ scopes: [org, team] })).resolves.toMatchObject({ changed: true });
      await expect(store.reconcileStructure({ scopes: [org, team] })).resolves.toMatchObject({ changed: false });
      await expect(
        store.reconcileStructure({
          scopes: [org, team, { address: 'team-2', name: 'team', parentAddresses: ['org:acme'] }],
        }),
      ).rejects.toThrow('Knowledge scope name team already exists under org:acme');
    });

    it('persists one content-capable node record', async () => {
      const node = await store.createNode({
        name: 'Deploy',
        kind: 'task',
        content: 'See [[Deploy]]',
        scope: resource,
        resolutionScope: thread,
      });
      const duplicate = await store.createNode({ name: 'deploy', kind: 'other', scope: resource });

      expect(duplicate.id).toBe(node.id);
      expect(await store.getNode(node.id)).toEqual(
        expect.objectContaining({ type: 'node', version: 1, content: 'See [[Deploy]]' }),
      );
      expect(await store.listNodes({ scope: thread, hasContent: true })).toEqual([
        expect.objectContaining({ id: node.id }),
      ]);
    });

    it('places created nodes into structural scopes by address', async () => {
      let scopeIds: Record<string, string>;
      try {
        const result = await store.reconcileStructure(STRUCTURE_PLAN);
        scopeIds = result.scopes;
      } catch (error) {
        if (isUnsupportedStructure(error)) {
          // Adapters without structural scope support must still reject placement
          // outright — never silently create an unplaced node.
          await expect(
            store.createNode({ name: 'Placed', kind: 'doc', scope: resource, scopeAddresses: ['features'] }),
          ).rejects.toThrow(/does not expose structural scope/);
          return;
        }
        throw error;
      }

      const node = await store.createNode({
        name: 'Placed',
        kind: 'doc',
        scope: resource,
        scopeAddresses: ['features'],
      });
      // Placement is additive membership: the identity scope is unchanged.
      expect(node.scope).toEqual(resource);
      expect(node.isScope).toBeUndefined();
      expect((await store.listScopeMembers({ scopeNodeId: scopeIds['features']! })).members).toEqual([
        expect.objectContaining({ id: node.id }),
      ]);

      // Unknown or deleted addresses fail the whole create without mutation.
      await expect(
        store.createNode({ name: 'Lost', kind: 'doc', scope: resource, scopeAddresses: ['missing'] }),
      ).rejects.toThrow(/scope/i);
      expect(await store.getNodeByName({ name: 'Lost', scope: resource })).toBeNull();

      // Writing about a node that already exists still places it, and still rejects unknown addresses.
      const existing = await store.createNode({ name: 'Existing', kind: 'doc', scope: resource });
      const placed = await store.createNode({
        name: 'existing',
        kind: 'doc',
        scope: resource,
        scopeAddresses: ['org:acme'],
      });
      expect(placed.id).toBe(existing.id);
      expect((await store.listScopeMembers({ scopeNodeId: scopeIds['org:acme']! })).members).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: existing.id })]),
      );
      await expect(
        store.createNode({ name: 'Existing', kind: 'doc', scope: resource, scopeAddresses: ['missing'] }),
      ).rejects.toThrow(/scope/i);

      // Updates keep structural placement: a description-only update (what the curator
      // does right after creating a node) and a rescope both leave the node placed.
      const described = await store.updateNode({ id: node.id, version: node.version, description: 'short summary' });
      expect((await store.listScopeMembers({ scopeNodeId: scopeIds['features']! })).members).toEqual([
        expect.objectContaining({ id: node.id }),
      ]);
      await store.updateNode({ id: node.id, version: described.version, scope: ['org:acme'] });
      expect((await store.listScopeMembers({ scopeNodeId: scopeIds['features']! })).members).toEqual([
        expect.objectContaining({ id: node.id }),
      ]);
    });

    it('treats scope identifiers literally when checking visibility', async () => {
      await store.createNode({ name: 'Percent secret', kind: 'secret', scope: ['org:acme%'] });
      await store.createNode({ name: 'Underscore secret', kind: 'secret', scope: ['org:acme_'] });

      expect(await store.listNodes({ scope: ['org:acmeX', 'resource:secret'] })).toEqual([]);
      await expect(
        store.createNode({ name: 'Separator secret', kind: 'secret', scope: ['org:acme\u001fresource:secret'] }),
      ).rejects.toThrow('Invalid knowledge scope entry');
    });

    it('treats lexical query metacharacters literally', async () => {
      const percent = await store.createNode({
        name: 'Literal% node',
        kind: 'document',
        content: 'contains percent% text',
        scope: resource,
      });
      await store.createNode({ name: 'LiteralX node', kind: 'document', content: 'control text', scope: resource });
      const underscore = await store.createNode({
        name: 'Under_score node',
        kind: 'document',
        content: 'contains under_score text',
        scope: resource,
      });
      await store.createNode({ name: 'UnderXscore node', kind: 'document', content: 'control text', scope: resource });
      const escape = await store.createNode({
        name: 'Equal= node',
        kind: 'document',
        content: 'contains equal=sign text',
        scope: resource,
      });

      expect(await store.listNodes({ scope: resource, namePrefix: 'Literal%' })).toEqual([
        expect.objectContaining({ id: percent.id }),
      ]);
      expect(await store.search({ query: '%', scope: resource })).toEqual([
        expect.objectContaining({ id: percent.id }),
      ]);
      expect(await store.search({ query: '_', scope: resource })).toEqual([
        expect.objectContaining({ id: underscore.id }),
      ]);
      expect(await store.search({ query: '=', scope: resource })).toEqual([expect.objectContaining({ id: escape.id })]);
    });

    it('applies record visibility independently from node scope', async () => {
      const node = await store.createNode({ name: 'Resource node', kind: 'task', scope: resource });
      const record = await store.appendKnowledge({
        node,
        text: 'organization-visible knowledge',
        scope: ['org:acme'],
        sourceThreadId: 't1',
        resolutionScope: thread,
        defaultScope: resource,
      });

      expect((await store.listKnowledgeAbout({ node, scope: ['org:acme'] })).records).toHaveLength(1);
      expect(await store.search({ query: 'organization-visible', scope: ['org:acme'] })).toEqual([
        expect.objectContaining({
          type: 'record',
          recordId: record.id,
          name: '(private node)',
          scope: ['org:acme'],
        }),
      ]);
    });

    it('resolves names only through visible nodes or merged aliases with a visible terminal', async () => {
      const sibling = [...resource, 'thread:t2'];
      const foreign = ['org:acme', 'resource:foreign'];
      const alias = await store.createNode({ name: 'Resolve Alias', kind: 'person', scope: sibling });
      const target = await store.createNode({ name: 'Resolve Target', kind: 'person', scope: resource });
      await store.mergeNodes({ sourceId: alias.id, targetId: target.id, sourceVersion: alias.version });
      await store.createNode({ name: 'Resolve Hidden', kind: 'person', scope: foreign });
      const foreignAlias = await store.createNode({
        name: 'Resolve Foreign Alias',
        kind: 'person',
        scope: [...foreign, 'thread:f1'],
      });
      const foreignTarget = await store.createNode({ name: 'Resolve Foreign Target', kind: 'person', scope: foreign });
      await store.mergeNodes({
        sourceId: foreignAlias.id,
        targetId: foreignTarget.id,
        sourceVersion: foreignAlias.version,
      });

      await expect(store.resolveNode({ name: 'Resolve Alias', scope: thread })).resolves.toMatchObject({
        id: target.id,
      });
      await expect(store.resolveNode({ name: 'Resolve Hidden', scope: thread })).resolves.toBeNull();
      await expect(store.resolveNode({ name: 'Resolve Foreign Alias', scope: thread })).resolves.toBeNull();
    });

    it('queries arbitrary companion scope memberships as visible scope subsets', async () => {
      const resourceCompanion = 'resource:r1:uncurated';
      const threadCompanion = 'thread:t1:uncurated';
      const queryScope = [...thread, resourceCompanion, threadCompanion];
      const target = await store.createNode({ name: 'Companion Target', kind: 'person', scope: resource });
      const node = await store.createNode({
        name: 'Companion Draft',
        kind: 'note',
        scope: [resourceCompanion, threadCompanion],
      });
      const record = await store.appendKnowledge({
        node,
        text: 'Draft mentions [[Companion Target]].',
        scope: [threadCompanion],
        sourceThreadId: 't1',
        resolutionScope: queryScope,
        defaultScope: node.scope,
      });

      expect((await store.listNodes({ scope: queryScope })).map(result => result.id)).toContain(node.id);
      await expect(store.resolveNode({ name: node.name, scope: queryScope })).resolves.toMatchObject({ id: node.id });
      expect(await store.search({ query: 'Draft mentions', scope: queryScope })).toEqual([
        expect.objectContaining({ id: record.id, recordId: node.id }),
      ]);
      expect((await store.listKnowledgeAbout({ node, scope: queryScope })).records.map(result => result.id)).toEqual([
        record.id,
      ]);
      expect(
        (await store.listKnowledgeRelatedTo({ node: target, scope: queryScope })).records.map(result => result.id),
      ).toEqual([record.id]);
    });

    it('persists optional KnowledgeRecord metadata and returns it on reads', async () => {
      const node = await store.createNode({ name: 'Jane meta', kind: 'person', scope: resource });
      const withMetadata = await store.appendKnowledge({
        node: node.id,
        text: 'Prefers tabs.',
        scope: resource,
        sourceThreadId: 't1',
        metadata: { reason: 'Durable style preference stated explicitly.' },
        resolutionScope: thread,
        defaultScope: resource,
      });
      const withoutMetadata = await store.appendKnowledge({
        node: node.id,
        text: 'Likes coffee.',
        scope: resource,
        sourceThreadId: 't1',
        resolutionScope: thread,
        defaultScope: resource,
      });
      expect(withMetadata.metadata).toEqual({ reason: 'Durable style preference stated explicitly.' });
      expect((await store.getKnowledge({ id: withMetadata.id }))?.metadata).toEqual({
        reason: 'Durable style preference stated explicitly.',
      });
      expect((await store.getKnowledge({ id: withoutMetadata.id }))?.metadata).toBeUndefined();
    });

    it('maintains mentions and soft deletes without losing them', async () => {
      const jane = await store.createNode({ name: 'Jane', kind: 'person', scope: resource });
      const marco = await store.createNode({ name: 'Marco', kind: 'person', scope: resource });
      const record = await store.appendKnowledge({
        node: jane,
        text: 'Works with [[Marco]].',
        scope: resource,
        sourceThreadId: 't1',
        resolutionScope: thread,
        defaultScope: resource,
      });
      expect((await store.listKnowledgeMentioning({ node: marco, scope: thread })).records[0]?.id).toBe(record.id);
      expect((await store.listKnowledgeRelatedTo({ node: marco, scope: thread })).records[0]?.id).toBe(record.id);
      await store.removeKnowledge({ id: record.id, deletedBy: 'curator' });
      expect(await store.getKnowledge({ id: record.id })).toBeNull();
      await store.restoreKnowledge({ id: record.id });
      expect((await store.listKnowledgeRelatedTo({ node: marco, scope: thread })).records[0]?.id).toBe(record.id);
    });

    it('rejects merges whose target is narrower than the source alias', async () => {
      const broad = await store.createNode({ name: 'Broad alias', kind: 'person', scope: ['org:acme'] });
      const narrow = await store.createNode({ name: 'Narrow target', kind: 'person', scope: resource });
      await expect(
        store.mergeNodes({ sourceId: broad.id, targetId: narrow.id, sourceVersion: broad.version }),
      ).rejects.toThrow('target that is narrower');
    });

    it('repoints merge relationships and schedules old-scope semantic cleanup', async () => {
      const target = await store.createNode({ name: 'Jane', kind: 'person', scope: resource });
      const duplicate = await store.createNode({ name: 'Jane Doe', kind: 'person', scope: resource });
      await store.createNode({ kind: 'document', name: 'People', content: 'Contact [[Jane Doe]]', scope: resource });
      const project = await store.createNode({ name: 'Project', kind: 'task', scope: resource });
      const record = await store.appendKnowledge({
        node: project.id,
        text: 'Owned by [[Jane Doe]]',
        scope: resource,
        sourceThreadId: 't1',
        resolutionScope: thread,
        defaultScope: resource,
      });
      const beforeMerge = (await store.listSemanticOutbox()).length;
      await store.mergeNodes({ sourceId: duplicate.id, targetId: target.id, sourceVersion: duplicate.version });
      const mergeEntries = (await store.listSemanticOutbox()).slice(beforeMerge);
      expect(mergeEntries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ documentId: `knowledge:node:${duplicate.id}`, operation: 'delete' }),
          expect.objectContaining({ documentId: `knowledge:node:${target.id}`, operation: 'upsert' }),
          expect.objectContaining({ documentType: 'record' }),
        ]),
      );
      const postMergeKnowledge = await store.appendKnowledge({
        node: project.id,
        text: 'Still references [[Jane Doe]]',
        scope: resource,
        sourceThreadId: 't1',
        resolutionScope: thread,
        defaultScope: resource,
      });
      expect(
        (await store.listKnowledgeRelatedTo({ node: target.id, scope: thread })).records.map(record => record.id),
      ).toContain(postMergeKnowledge.id);
      expect((await store.createNode({ name: 'Jane Doe', kind: 'person', scope: resource })).id).toBe(target.id);
      const fallbackKnowledge = await store.appendKnowledge({
        node: project.id,
        text: 'Fallback references [[Jane Doe]]',
        scope: resource,
        sourceThreadId: 't1',
        resolutionScope: ['org:acme'],
        defaultScope: resource,
      });
      expect(
        (await store.listKnowledgeRelatedTo({ node: target.id, scope: thread })).records.map(record => record.id),
      ).toContain(fallbackKnowledge.id);

      const beforeRescope = (await store.listSemanticOutbox()).length;
      await store.rescopeKnowledge({ id: record.id, scope: ['org:acme'] });
      expect((await store.listSemanticOutbox()).slice(beforeRescope)).toEqual([
        expect.objectContaining({ operation: 'delete', scope: resource }),
        expect.objectContaining({ operation: 'upsert', scope: ['org:acme'] }),
      ]);
    });

    it('deletes stale semantic scopes when records move', async () => {
      const node = await store.createNode({ name: 'Movable', kind: 'task', content: 'body', scope: resource });
      const record = await store.appendKnowledge({
        node: node.id,
        text: 'dependent record',
        scope: resource,
        sourceThreadId: 't1',
        resolutionScope: thread,
        defaultScope: resource,
      });
      const before = (await store.listSemanticOutbox()).length;

      await store.updateNode({ id: node.id, version: node.version, scope: ['org:acme'] });

      const entries = (await store.listSemanticOutbox()).slice(before);
      expect(entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            documentId: `knowledge:node:${node.id}`,
            operation: 'delete',
            scope: resource,
          }),
          expect.objectContaining({
            documentId: `knowledge:node:${node.id}`,
            operation: 'upsert',
            scope: ['org:acme'],
          }),
          expect.objectContaining({ documentId: `knowledge:record:${record.id}`, operation: 'delete' }),
          expect.objectContaining({ documentId: `knowledge:record:${record.id}`, operation: 'upsert' }),
        ]),
      );
    });

    it('enforces record CAS and scope structure atomically', async () => {
      await expect(store.createNode({ name: 'Invalid', kind: 'task', scope: ['thread:t1'] })).rejects.toThrow(
        'requires resource and org',
      );
      await expect(store.listNodes({ scope: ['thread:t1'] })).rejects.toThrow('requires resource and org');
      await expect(store.search({ query: 'anything', scope: ['resource:mastra'] })).rejects.toThrow('requires an org');
      const guide = await store.createNode({ kind: 'document', name: 'Guide', content: 'one', scope: resource });
      await store.updateNode({ id: guide.id, version: guide.version, content: 'two' });
      await expect(store.updateNode({ id: guide.id, version: guide.version, content: 'stale' })).rejects.toThrow(
        'version conflict',
      );

      const node = await store.createNode({ name: 'Secret', kind: 'task', scope: resource });
      await store.updateNode({ id: node.id, version: node.version, kind: 'project' });
      await expect(store.updateNode({ id: node.id, version: node.version, kind: 'stale' })).rejects.toThrow(
        'version conflict',
      );
      const record = await store.appendKnowledge({
        node: node.id,
        text: 'private',
        scope: resource,
        sourceThreadId: 't1',
        resolutionScope: thread,
        defaultScope: resource,
      });
      // Knowledge v2 has no record ceilings: a record can be widened to any scope.
      await expect(store.rescopeKnowledge({ id: record.id, scope: ['org:acme'] })).resolves.toMatchObject({
        scope: ['org:acme'],
      });
      const widened = await store.getKnowledge({ id: record.id });
      expect(widened?.scope).toEqual(['org:acme']);
      expect(widened).not.toHaveProperty('maxScope');

      const orgNode = await store.createNode({ name: 'Team practice', kind: 'task', scope: ['org:acme'] });
      const orgRecord = await store.appendKnowledge({
        node: orgNode.id,
        text: 'Reviews happen on Tuesdays',
        scope: ['org:acme'],
        sourceThreadId: 't1',
        resolutionScope: thread,
        defaultScope: resource,
      });
      expect((await store.getKnowledge({ id: orgRecord.id }))?.scope).toEqual(['org:acme']);
    });

    it('serializes semantic work for successive versions of the same document', async () => {
      const node = await store.createNode({ name: 'Atlas', kind: 'task', scope: resource });
      await store.updateNode({ id: node.id, version: node.version, kind: 'project' });

      const first = await store.claimSemanticOutbox({ workerId: 'first', limit: 10 });
      expect(first).toHaveLength(1);
      expect(first[0]?.documentId).toBe(`knowledge:node:${node.id}`);
      expect(await store.claimSemanticOutbox({ workerId: 'second', limit: 10 })).toEqual([]);

      await store.completeSemanticOutbox({ ids: [first[0]!.id], workerId: 'first' });
      const second = await store.claimSemanticOutbox({ workerId: 'second', limit: 10 });
      expect(second).toHaveLength(1);
      expect(second[0]?.documentId).toBe(first[0]?.documentId);
    });

    it('persists description independently of content', async () => {
      const node = await store.createNode({
        name: 'Described',
        kind: 'task',
        content: 'long-form body',
        description: 'Short synopsis.',
        scope: resource,
      });
      expect((await store.getNode(node.id))?.description).toBe('Short synopsis.');

      const afterDescription = await store.updateNode({
        id: node.id,
        version: node.version,
        description: 'Updated synopsis.',
      });
      expect(afterDescription.description).toBe('Updated synopsis.');
      expect(afterDescription.content).toBe('long-form body');

      const afterContent = await store.updateNode({
        id: node.id,
        version: afterDescription.version,
        content: 'revised body',
      });
      expect(afterContent.description).toBe('Updated synopsis.');
      expect(afterContent.content).toBe('revised body');

      await expect(
        store.updateNode({ id: node.id, version: afterDescription.version, description: 'stale write' }),
      ).rejects.toThrow('version conflict');

      const cleared = await store.updateNode({ id: node.id, version: afterContent.version, description: '' });
      expect(cleared.description).toBe('');
    });

    it('enforces the description length bound on create and update alike', async () => {
      const atLimit = 'x'.repeat(MAX_KNOWLEDGE_NODE_DESCRIPTION_LENGTH);
      const overLimit = 'x'.repeat(MAX_KNOWLEDGE_NODE_DESCRIPTION_LENGTH + 1);

      const node = await store.createNode({ name: 'At limit', kind: 'task', description: atLimit, scope: resource });
      expect((await store.getNode(node.id))?.description).toBe(atLimit);

      await expect(
        store.createNode({ name: 'Over limit', kind: 'task', description: overLimit, scope: resource }),
      ).rejects.toThrow(`${MAX_KNOWLEDGE_NODE_DESCRIPTION_LENGTH} UTF-16 code unit limit`);
      expect(await store.getNodeByName({ name: 'Over limit', scope: resource })).toBeNull();

      await expect(store.updateNode({ id: node.id, version: node.version, description: overLimit })).rejects.toThrow(
        `${MAX_KNOWLEDGE_NODE_DESCRIPTION_LENGTH} UTF-16 code unit limit`,
      );

      // A rejected update leaves the node exactly as it was — no partial write, no version bump.
      const untouched = await store.getNode(node.id);
      expect(untouched?.description).toBe(atLimit);
      expect(untouched?.version).toBe(node.version);
    });

    it('rejects record text over the length bound before writing anything', async () => {
      const node = await store.createNode({ name: 'Bounded records', kind: 'service', scope: resource });
      const append = (text: string) =>
        store.appendKnowledge({
          node,
          text,
          scope: resource,
          sourceThreadId: 't1',
          resolutionScope: thread,
          defaultScope: resource,
        });

      const atLimit = '😀'.repeat(MAX_KNOWLEDGE_RECORD_TEXT_LENGTH / 2);
      expect((await append(atLimit)).text).toBe(atLimit);
      await expect(append(`${atLimit}x`)).rejects.toThrow(`${MAX_KNOWLEDGE_RECORD_TEXT_LENGTH} UTF-16 code unit limit`);

      const records = (await store.listKnowledgeAbout({ node, scope: resource })).records;
      expect(records.map(record => record.text)).toEqual([atLimit]);
    });

    it('counts the description bound in UTF-16 code units', async () => {
      // 200 astral characters are 400 UTF-16 code units: at the limit, not over it.
      const astralAtLimit = '😀'.repeat(MAX_KNOWLEDGE_NODE_DESCRIPTION_LENGTH / 2);
      expect(astralAtLimit.length).toBe(MAX_KNOWLEDGE_NODE_DESCRIPTION_LENGTH);
      const node = await store.createNode({
        name: 'Astral',
        kind: 'task',
        description: astralAtLimit,
        scope: resource,
      });
      expect((await store.getNode(node.id))?.description).toBe(astralAtLimit);

      await expect(
        store.createNode({
          name: 'Astral over',
          kind: 'task',
          description: `${astralAtLimit}😀`,
          scope: resource,
        }),
      ).rejects.toThrow(`${MAX_KNOWLEDGE_NODE_DESCRIPTION_LENGTH} UTF-16 code unit limit`);
    });

    it('round-trips a node without description as undefined', async () => {
      const node = await store.createNode({ name: 'Bare', kind: 'task', content: 'body', scope: resource });
      expect((await store.getNode(node.id))?.description).toBeUndefined();
    });

    it('applies the merge description matrix with target mutation', async () => {
      // target has description => target's wins
      const keepTarget = await store.createNode({
        name: 'Keep target',
        kind: 'person',
        description: 'target synopsis',
        scope: resource,
      });
      const keepSource = await store.createNode({
        name: 'Keep source',
        kind: 'person',
        description: 'source synopsis',
        scope: resource,
      });
      const keepVersion = keepTarget.version;
      await store.mergeNodes({ sourceId: keepSource.id, targetId: keepTarget.id, sourceVersion: keepSource.version });
      const keptTarget = await store.getNode(keepTarget.id);
      expect(keptTarget?.description).toBe('target synopsis');
      expect(keptTarget?.version).toBe(keepVersion);

      // target absent + source present => adopt source's, bump target version, enqueue upsert
      const adoptTarget = await store.createNode({ name: 'Adopt target', kind: 'person', scope: resource });
      const adoptSource = await store.createNode({
        name: 'Adopt source',
        kind: 'person',
        description: 'adopted synopsis',
        scope: resource,
      });
      const beforeAdopt = (await store.listSemanticOutbox()).length;
      await store.mergeNodes({
        sourceId: adoptSource.id,
        targetId: adoptTarget.id,
        sourceVersion: adoptSource.version,
      });
      const adopted = await store.getNode(adoptTarget.id);
      expect(adopted?.description).toBe('adopted synopsis');
      expect(adopted?.version).toBe(adoptTarget.version + 1);
      expect((await store.listSemanticOutbox()).slice(beforeAdopt)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ documentId: `knowledge:node:${adoptTarget.id}`, operation: 'upsert' }),
        ]),
      );

      // both absent => stays absent
      const bareTarget = await store.createNode({ name: 'Bare target', kind: 'person', scope: resource });
      const bareSource = await store.createNode({ name: 'Bare source', kind: 'person', scope: resource });
      await store.mergeNodes({ sourceId: bareSource.id, targetId: bareTarget.id, sourceVersion: bareSource.version });
      expect((await store.getNode(bareTarget.id))?.description).toBeUndefined();

      // target explicitly cleared ('') => the clear wins; merge must not resurrect the source synopsis
      const clearedSeed = await store.createNode({
        name: 'Cleared target',
        kind: 'person',
        description: 'stale synopsis',
        scope: resource,
      });
      const clearedTarget = await store.updateNode({
        id: clearedSeed.id,
        version: clearedSeed.version,
        description: '',
      });
      const clearedSource = await store.createNode({
        name: 'Cleared source',
        kind: 'person',
        description: 'resurrected synopsis',
        scope: resource,
      });
      await store.mergeNodes({
        sourceId: clearedSource.id,
        targetId: clearedTarget.id,
        sourceVersion: clearedSource.version,
      });
      const cleared = await store.getNode(clearedTarget.id);
      expect(cleared?.description).toBe('');
      expect(cleared?.version).toBe(clearedTarget.version);
    });

    it('never lets merge adoption clobber a concurrent description write', async () => {
      const target = await store.createNode({ name: 'Race target', kind: 'person', scope: resource });
      const source = await store.createNode({
        name: 'Race source',
        kind: 'person',
        description: 'source synopsis',
        scope: resource,
      });

      // Both writers start from the same observed target version. Adoption is conditional on that
      // version still holding, so exactly one of these can win — and whichever loses must not
      // silently overwrite the winner's value.
      const [mergeResult, concurrentResult] = await Promise.allSettled([
        store.mergeNodes({ sourceId: source.id, targetId: target.id, sourceVersion: source.version }),
        store.updateNode({ id: target.id, version: target.version, description: 'concurrent synopsis' }),
      ]);
      expect(mergeResult.status).toBe('fulfilled');

      const finalTarget = await store.getNode(target.id);
      if (concurrentResult.status === 'fulfilled') {
        expect(finalTarget?.description).toBe('concurrent synopsis');
      } else {
        expect(finalTarget?.description).toBe('source synopsis');
      }
      expect(finalTarget?.version).toBe(target.version + 1);
    });

    it('never lets merge adoption resurrect a synopsis over a concurrent explicit clear', async () => {
      const target = await store.createNode({ name: 'Clear race target', kind: 'person', scope: resource });
      const source = await store.createNode({
        name: 'Clear race source',
        kind: 'person',
        description: 'source synopsis',
        scope: resource,
      });

      // Same conditional-adoption race as above, except the competing writer clears the description
      // rather than replacing it. An empty string is a deliberate value, not an absence, so if the
      // clear wins the merge must not treat the target as description-less and adopt the source.
      // Which writer wins is adapter-specific — a store that serializes the merge transaction first
      // never reaches the clear branch — so the load-bearing assertion is the single version bump:
      // an adoption and a clear can never both commit.
      const [mergeResult, clearResult] = await Promise.allSettled([
        store.mergeNodes({ sourceId: source.id, targetId: target.id, sourceVersion: source.version }),
        store.updateNode({ id: target.id, version: target.version, description: '' }),
      ]);
      expect(mergeResult.status).toBe('fulfilled');

      const finalTarget = await store.getNode(target.id);
      if (clearResult.status === 'fulfilled') {
        expect(finalTarget?.description).toBe('');
      } else {
        // The clear may only lose to a version conflict; an adapter that rejected the empty string
        // outright would otherwise land here and pass while breaking the ''-is-a-value contract.
        expect(clearResult.reason).toBeInstanceOf(KnowledgeConflictError);
        expect(finalTarget?.description).toBe('source synopsis');
      }
      expect(finalTarget?.version).toBe(target.version + 1);
    });

    it('matches descriptions in lexical search and keeps description-less text unchanged', async () => {
      const described = await store.createNode({
        name: 'Search described',
        kind: 'task',
        content: 'plain body',
        description: 'findable zebra synopsis',
        scope: resource,
      });
      const plain = await store.createNode({
        name: 'Search plain',
        kind: 'task',
        content: 'ordinary body',
        scope: resource,
      });

      const byDescription = await store.search({ query: 'zebra', scope: resource });
      expect(byDescription).toEqual([expect.objectContaining({ id: described.id })]);
      expect(byDescription[0]?.text).toBe('Search described\nfindable zebra synopsis\nplain body');

      const byContent = await store.search({ query: 'ordinary', scope: resource });
      expect(byContent).toEqual([expect.objectContaining({ id: plain.id })]);
      // description-less result text is byte-identical to the pre-description shape
      expect(byContent[0]?.text).toBe('Search plain\nordinary body');
    });

    it('dangerously clears every knowledge table', async () => {
      const node = await store.createNode({ name: 'Temporary', kind: 'task', scope: resource });
      const record = await store.appendKnowledge({
        node: node.id,
        text: 'temporary record',
        scope: resource,
        sourceThreadId: 't1',
        resolutionScope: thread,
        defaultScope: resource,
      });

      await store.dangerouslyClearAll();

      expect(await store.getNode(node.id)).toBeNull();
      expect(await store.getKnowledge({ id: record.id, includeDeleted: true })).toBeNull();
      expect(await store.listActivity({ scope: thread })).toEqual([]);
      expect(await store.listSemanticOutbox()).toEqual([]);
    });

    it('paginates activity from newest to oldest without duplicates', async () => {
      await store.createNode({ name: 'Activity one', kind: 'task', scope: resource });
      await store.createNode({ name: 'Activity two', kind: 'task', scope: resource });
      await store.createNode({ name: 'Activity three', kind: 'task', scope: resource });

      const all = await store.listActivity({ scope: thread });
      const first = await store.listActivity({ scope: thread, limit: 2 });
      const second = await store.listActivity({ scope: thread, after: first.at(-1)!.id, limit: 2 });

      expect(first.map(event => event.id)).toEqual(all.slice(0, 2).map(event => event.id));
      expect(second.map(event => event.id)).toEqual(all.slice(2).map(event => event.id));
    });

    it('rejects the deprecated curation cursor methods', async () => {
      await expect(store.getCurationCursor({ sourceThreadId: 't1', agent: 'curate' })).rejects.toThrow(
        'Knowledge curation cursors were removed',
      );
      await expect(
        store.advanceCurationCursor({
          sourceThreadId: 't1',
          agent: 'curate',
          lastKnowledgeId: '01J00000000000000000000000',
        }),
      ).rejects.toThrow('Knowledge curation cursors were removed');
    });

    it('persists activity and recoverable semantic work', async () => {
      const node = await store.createNode({ name: 'Release', kind: 'task', scope: resource });
      expect((await store.listActivity({ scope: thread }))[0]).toEqual(expect.objectContaining({ recordId: node.id }));
      const pending = await store.listSemanticOutbox({ status: 'pending' });
      expect(pending).toHaveLength(1);
      const claimed = await store.claimSemanticOutbox({
        workerId: 'worker',
        now: new Date(pending[0]!.availableAt.getTime() + 1),
      });
      await store.releaseSemanticOutbox({ ids: [claimed[0]!.id], workerId: 'worker' });
      expect((await store.listSemanticOutbox({ status: 'pending' }))[0]?.attempts).toBe(1);
    });
  });
}
