import { randomUUID } from 'node:crypto';

import type {
  AgentVersion,
  AgentsStorage,
  DeleteVersionLabelInput,
  SetVersionLabelInput,
  VersionLabelPointer,
  VersionLabelStorageChannel,
} from '@mastra/core/storage';
import { beforeEach, describe, expect, it } from 'vitest';

import { createSampleAgent } from './data';

export type VersionLabelSupportExpectation = 'supported' | 'unsupported';

type AgentFixture = {
  agentId: string;
  versions: AgentVersion[];
};

type VersionLabelTestOptions = {
  getAgentsStorage: () => AgentsStorage;
  expectedSupport?: VersionLabelSupportExpectation;
};

const EXPECTED_CAPABILITIES = {
  read: true,
  write: true,
  compareAndSwap: true,
  retentionProtection: true,
} as const;

async function createAgentFixture(
  storage: AgentsStorage,
  { versionCount = 3, prefix = 'Label test' }: { versionCount?: number; prefix?: string } = {},
): Promise<AgentFixture> {
  const agentId = `version-label-agent-${randomUUID()}`;
  const model = { provider: 'openai', name: 'gpt-4' };

  await storage.create({
    agent: createSampleAgent({
      id: agentId,
      name: `${prefix} v1`,
      instructions: `${prefix} instructions v1`,
      model,
    }),
  });

  const initialVersion = await storage.getLatestVersion(agentId);
  if (!initialVersion) {
    throw new Error(`Expected initial version for agent ${agentId}`);
  }

  const versions = [initialVersion];
  for (let versionNumber = 2; versionNumber <= versionCount; versionNumber++) {
    versions.push(
      await storage.createVersion({
        id: randomUUID(),
        agentId,
        versionNumber,
        name: `${prefix} v${versionNumber}`,
        instructions: `${prefix} instructions v${versionNumber}`,
        model,
        changedFields: ['name', 'instructions'],
        changeMessage: `Create version ${versionNumber}`,
      }),
    );
  }

  return { agentId, versions };
}

function requireVersionLabels(storage: AgentsStorage): VersionLabelStorageChannel<'agent'> {
  const channel = storage.versionLabels;
  expect(channel, 'adapter was declared version-label capable').toBeDefined();
  if (!channel || channel.entityType !== 'agent') {
    throw new Error('Expected an agent version-label storage channel');
  }
  return channel as VersionLabelStorageChannel<'agent'>;
}

function setLabel(
  channel: VersionLabelStorageChannel<'agent'>,
  input: {
    entityId: string;
    label: string;
    versionId: string;
    expectedRevisionToken: string | null;
  },
): Promise<VersionLabelPointer<'agent'>> {
  return channel.set({ entityType: 'agent', ...input });
}

function getLabel(
  channel: VersionLabelStorageChannel<'agent'>,
  entityId: string,
  label: string,
): Promise<VersionLabelPointer<'agent'> | null> {
  return channel.get({ entityType: 'agent', entityId, label });
}

function deleteLabel(
  channel: VersionLabelStorageChannel<'agent'>,
  pointer: Pick<VersionLabelPointer<'agent'>, 'entityId' | 'label' | 'revisionToken'>,
) {
  return channel.delete({
    entityType: 'agent',
    entityId: pointer.entityId,
    label: pointer.label,
    expectedRevisionToken: pointer.revisionToken,
  });
}

/**
 * Shared custom agent-version-label conformance.
 *
 * Support is an explicit expectation supplied by each adapter invocation. The
 * suite never decides to skip by reading the adapter's own capability claim.
 */
export function createVersionLabelTests({ getAgentsStorage, expectedSupport }: VersionLabelTestOptions): void {
  if (expectedSupport === undefined) return;

  if (expectedSupport === 'unsupported') {
    describe('Agent version labels (expected unsupported)', () => {
      let storage: AgentsStorage;

      beforeEach(async () => {
        storage = getAgentsStorage();
        await storage.dangerouslyClearAll();
      });

      it('advertises no custom agent-label capability', () => {
        expect(storage.versionLabels).toBeUndefined();
        expect(storage.storageCapabilities.versionLabels.entityTypes.agent).toBeUndefined();
      });

      it('fails custom-label resolution with the stable unsupported error while computed labels still work', async () => {
        const { agentId, versions } = await createAgentFixture(storage, { versionCount: 2 });

        await expect(storage.getByIdResolved(agentId, { label: 'staging' })).rejects.toMatchObject({
          id: 'VERSION_LABELS_UNSUPPORTED',
        });

        await expect(storage.getByIdResolved(agentId, { label: 'latest' })).resolves.toMatchObject({
          resolvedVersionId: versions[1]!.id,
          selectedVersionLabel: 'latest',
        });

        await storage.update({ id: agentId, activeVersionId: versions[0]!.id, status: 'published' });
        await expect(storage.getByIdResolved(agentId, { label: 'production' })).resolves.toMatchObject({
          resolvedVersionId: versions[0]!.id,
          selectedVersionLabel: 'production',
        });
      });
    });
    return;
  }

  describe('Agent version labels (expected supported)', () => {
    let storage: AgentsStorage;
    let channel: VersionLabelStorageChannel<'agent'>;

    beforeEach(async () => {
      storage = getAgentsStorage();
      await storage.dangerouslyClearAll();
      channel = requireVersionLabels(storage);
    });

    it('advertises the complete custom agent-label capability shape', () => {
      expect(channel.entityType).toBe('agent');
      expect(channel.capabilities).toEqual(EXPECTED_CAPABILITIES);
      expect(storage.storageCapabilities).toEqual({
        versionLabels: {
          entityTypes: {
            agent: EXPECTED_CAPABILITIES,
          },
        },
      });
    });

    it('enforces the exact label grammar without trimming or normalization', async () => {
      const { agentId, versions } = await createAgentFixture(storage, { versionCount: 1 });
      const target = versions[0]!;

      for (const label of ['a', `a${'b'.repeat(62)}z`]) {
        await expect(
          setLabel(channel, { entityId: agentId, label, versionId: target.id, expectedRevisionToken: null }),
        ).resolves.toMatchObject({ label, versionId: target.id });
      }

      for (const label of [
        '',
        'A',
        'Staging',
        ' staging',
        'staging ',
        '.staging',
        'staging-',
        'with/slash',
        'with%2fencoding',
        'with space',
        'staging‑unicode',
        `a${'b'.repeat(64)}`,
      ]) {
        await expect(
          setLabel(channel, { entityId: agentId, label, versionId: target.id, expectedRevisionToken: null }),
        ).rejects.toMatchObject({ id: 'INVALID_VERSION_LABEL' });
      }

      expect(await getLabel(channel, agentId, 'staging')).toBeNull();
    });

    it('rejects computed names through custom-label mutation methods', async () => {
      const { agentId, versions } = await createAgentFixture(storage, { versionCount: 1 });

      for (const label of ['production', 'latest']) {
        await expect(
          setLabel(channel, {
            entityId: agentId,
            label,
            versionId: versions[0]!.id,
            expectedRevisionToken: null,
          }),
        ).rejects.toMatchObject({ id: 'RESERVED_VERSION_LABEL' });

        await expect(
          channel.delete({
            entityType: 'agent',
            entityId: agentId,
            label,
            expectedRevisionToken: randomUUID(),
          }),
        ).rejects.toMatchObject({ id: 'RESERVED_VERSION_LABEL' });
      }
    });

    it('creates, gets, deterministically paginates, reverse-lists, and deletes labels', async () => {
      const { agentId, versions } = await createAgentFixture(storage, { versionCount: 2 });
      const zeta = await setLabel(channel, {
        entityId: agentId,
        label: 'zeta',
        versionId: versions[0]!.id,
        expectedRevisionToken: null,
      });
      const alpha = await setLabel(channel, {
        entityId: agentId,
        label: 'alpha',
        versionId: versions[0]!.id,
        expectedRevisionToken: null,
      });
      const middle = await setLabel(channel, {
        entityId: agentId,
        label: 'middle',
        versionId: versions[1]!.id,
        expectedRevisionToken: null,
      });

      expect(alpha).toMatchObject({
        entityType: 'agent',
        entityId: agentId,
        label: 'alpha',
        versionId: versions[0]!.id,
        revisionToken: expect.any(String),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      expect(alpha.revisionToken.length).toBeGreaterThan(0);
      expect(await getLabel(channel, agentId, 'alpha')).toEqual(alpha);

      const firstPage = await channel.list({ entityType: 'agent', entityId: agentId, page: 0, perPage: 2 });
      expect(firstPage).toMatchObject({ total: 3, page: 0, perPage: 2, hasMore: true });
      expect(firstPage.labels.map(pointer => pointer.label)).toEqual(['alpha', 'middle']);

      const secondPage = await channel.list({ entityType: 'agent', entityId: agentId, page: 1, perPage: 2 });
      expect(secondPage).toMatchObject({ total: 3, page: 1, perPage: 2, hasMore: false });
      expect(secondPage.labels.map(pointer => pointer.label)).toEqual(['zeta']);

      const unpaged = await channel.list({ entityType: 'agent', entityId: agentId, perPage: false });
      expect(unpaged.perPage).toBe(false);
      expect(unpaged.hasMore).toBe(false);
      expect(unpaged.labels.map(pointer => pointer.label)).toEqual(['alpha', 'middle', 'zeta']);

      const reverse = await channel.listByVersion({
        entityType: 'agent',
        entityId: agentId,
        versionId: versions[0]!.id,
      });
      expect(reverse.map(pointer => pointer.label)).toEqual(['alpha', 'zeta']);

      await expect(deleteLabel(channel, middle)).resolves.toEqual({ deleted: true });
      await expect(deleteLabel(channel, middle)).resolves.toEqual({ deleted: false });
      expect(await getLabel(channel, agentId, 'middle')).toBeNull();
      expect(await storage.getVersion(versions[1]!.id)).not.toBeNull();
      expect(
        await channel.listByVersion({ entityType: 'agent', entityId: agentId, versionId: versions[1]!.id }),
      ).toEqual([]);

      // Keep these referenced so a regression that aliases returned records is
      // caught by the full equality and reverse-index checks above.
      expect(zeta.label).toBe('zeta');
    });

    it('isolates the same label name between agents', async () => {
      const first = await createAgentFixture(storage, { versionCount: 1, prefix: 'First agent' });
      const second = await createAgentFixture(storage, { versionCount: 1, prefix: 'Second agent' });

      const firstPointer = await setLabel(channel, {
        entityId: first.agentId,
        label: 'staging',
        versionId: first.versions[0]!.id,
        expectedRevisionToken: null,
      });
      const secondPointer = await setLabel(channel, {
        entityId: second.agentId,
        label: 'staging',
        versionId: second.versions[0]!.id,
        expectedRevisionToken: null,
      });

      expect(firstPointer.versionId).toBe(first.versions[0]!.id);
      expect(secondPointer.versionId).toBe(second.versions[0]!.id);
      expect(firstPointer.revisionToken).not.toBe(secondPointer.revisionToken);
      expect(await getLabel(channel, first.agentId, 'staging')).toEqual(firstPointer);
      expect(await getLabel(channel, second.agentId, 'staging')).toEqual(secondPointer);
    });

    it('orders punctuation by ASCII code point across page boundaries', async () => {
      const { agentId, versions } = await createAgentFixture(storage, { versionCount: 1 });
      for (const label of ['a_b', 'a-b', 'a.b', 'a0b']) {
        await setLabel(channel, {
          entityId: agentId,
          label,
          versionId: versions[0]!.id,
          expectedRevisionToken: null,
        });
      }

      const firstPage = await channel.list({ entityType: 'agent', entityId: agentId, page: 0, perPage: 2 });
      const secondPage = await channel.list({ entityType: 'agent', entityId: agentId, page: 1, perPage: 2 });
      expect(firstPage.labels.map(pointer => pointer.label)).toEqual(['a-b', 'a.b']);
      expect(secondPage.labels.map(pointer => pointer.label)).toEqual(['a0b', 'a_b']);
      expect(firstPage.total).toBe(4);
      expect(secondPage.total).toBe(4);
    });

    it('rejects missing entities, missing versions, and versions owned by another agent', async () => {
      const first = await createAgentFixture(storage, { versionCount: 1 });
      const second = await createAgentFixture(storage, { versionCount: 1 });

      await expect(
        setLabel(channel, {
          entityId: `missing-agent-${randomUUID()}`,
          label: 'staging',
          versionId: first.versions[0]!.id,
          expectedRevisionToken: null,
        }),
      ).rejects.toMatchObject({ id: 'ENTITY_NOT_FOUND' });

      await expect(
        setLabel(channel, {
          entityId: first.agentId,
          label: 'staging',
          versionId: `missing-version-${randomUUID()}`,
          expectedRevisionToken: null,
        }),
      ).rejects.toMatchObject({ id: 'VERSION_NOT_FOUND' });

      await expect(
        setLabel(channel, {
          entityId: first.agentId,
          label: 'staging',
          versionId: second.versions[0]!.id,
          expectedRevisionToken: null,
        }),
      ).rejects.toMatchObject({ id: 'VERSION_NOT_OWNED_BY_ENTITY' });
    });

    it('keeps a labeled version immutable when its ID is reused for another agent', async () => {
      const first = await createAgentFixture(storage, { versionCount: 1, prefix: 'Immutable owner' });
      const second = await createAgentFixture(storage, { versionCount: 1, prefix: 'Duplicate writer' });
      await setLabel(channel, {
        entityId: first.agentId,
        label: 'staging',
        versionId: first.versions[0]!.id,
        expectedRevisionToken: null,
      });

      await expect(
        storage.createVersion({
          id: first.versions[0]!.id,
          agentId: second.agentId,
          versionNumber: 2,
          name: 'Attempted replacement',
          instructions: 'Must not replace the immutable target',
          model: { provider: 'openai', name: 'gpt-4' },
          changedFields: ['name', 'instructions'],
        }),
      ).rejects.toBeDefined();

      await expect(storage.getVersion(first.versions[0]!.id)).resolves.toMatchObject({
        id: first.versions[0]!.id,
        agentId: first.agentId,
      });
      await expect(storage.getByIdResolved(first.agentId, { label: 'staging' })).resolves.toMatchObject({
        id: first.agentId,
        resolvedVersionId: first.versions[0]!.id,
      });
      await expect(storage.deleteVersion(first.versions[0]!.id)).rejects.toMatchObject({
        id: 'VERSION_IN_USE_BY_LABEL',
      });
    });

    it('implements create-expects-absent and desired-state idempotency', async () => {
      const { agentId, versions } = await createAgentFixture(storage, { versionCount: 2 });
      const created = await setLabel(channel, {
        entityId: agentId,
        label: 'staging',
        versionId: versions[0]!.id,
        expectedRevisionToken: null,
      });

      const retriedCreate = await setLabel(channel, {
        entityId: agentId,
        label: 'staging',
        versionId: versions[0]!.id,
        expectedRevisionToken: null,
      });
      expect(retriedCreate).toEqual(created);

      const retriedWithStaleToken = await setLabel(channel, {
        entityId: agentId,
        label: 'staging',
        versionId: versions[0]!.id,
        expectedRevisionToken: `stale-${randomUUID()}`,
      });
      expect(retriedWithStaleToken).toEqual(created);

      await expect(
        setLabel(channel, {
          entityId: agentId,
          label: 'staging',
          versionId: versions[1]!.id,
          expectedRevisionToken: null,
        }),
      ).rejects.toMatchObject({
        id: 'VERSION_LABEL_CONFLICT',
        details: {
          currentRevisionToken: created.revisionToken,
          currentVersionId: versions[0]!.id,
        },
      });
    });

    it('rejects mutations without an explicit CAS precondition', async () => {
      const { agentId, versions } = await createAgentFixture(storage, { versionCount: 1 });
      const setWithoutPrecondition = {
        entityType: 'agent',
        entityId: agentId,
        label: 'staging',
        versionId: versions[0]!.id,
      };
      const deleteWithoutPrecondition = {
        entityType: 'agent',
        entityId: agentId,
        label: 'staging',
      };

      await expect(channel.set(setWithoutPrecondition as SetVersionLabelInput<'agent'>)).rejects.toMatchObject({
        id: 'VERSION_LABEL_CONFLICT',
      });
      await expect(channel.delete(deleteWithoutPrecondition as DeleteVersionLabelInput<'agent'>)).rejects.toMatchObject(
        {
          id: 'VERSION_LABEL_CONFLICT',
        },
      );
      expect(await getLabel(channel, agentId, 'staging')).toBeNull();
    });

    it('moves with CAS, replaces the token, and safely retries the completed move', async () => {
      const { agentId, versions } = await createAgentFixture(storage, { versionCount: 3 });
      const first = await setLabel(channel, {
        entityId: agentId,
        label: 'staging',
        versionId: versions[0]!.id,
        expectedRevisionToken: null,
      });
      const moved = await setLabel(channel, {
        entityId: agentId,
        label: 'staging',
        versionId: versions[1]!.id,
        expectedRevisionToken: first.revisionToken,
      });

      expect(moved.versionId).toBe(versions[1]!.id);
      expect(moved.revisionToken).not.toBe(first.revisionToken);
      expect(moved.createdAt).toEqual(first.createdAt);
      expect(moved.updatedAt.getTime()).toBeGreaterThanOrEqual(first.updatedAt.getTime());

      const retry = await setLabel(channel, {
        entityId: agentId,
        label: 'staging',
        versionId: versions[1]!.id,
        expectedRevisionToken: first.revisionToken,
      });
      expect(retry).toEqual(moved);

      await expect(
        setLabel(channel, {
          entityId: agentId,
          label: 'staging',
          versionId: versions[2]!.id,
          expectedRevisionToken: first.revisionToken,
        }),
      ).rejects.toMatchObject({
        id: 'VERSION_LABEL_CONFLICT',
        details: {
          currentRevisionToken: moved.revisionToken,
          currentVersionId: moved.versionId,
        },
      });
      expect(await getLabel(channel, agentId, 'staging')).toEqual(moved);
    });

    it('allows exactly one of two concurrent moves from the same observed state', async () => {
      const { agentId, versions } = await createAgentFixture(storage, { versionCount: 3 });
      const original = await setLabel(channel, {
        entityId: agentId,
        label: 'staging',
        versionId: versions[0]!.id,
        expectedRevisionToken: null,
      });

      const results = await Promise.allSettled([
        setLabel(channel, {
          entityId: agentId,
          label: 'staging',
          versionId: versions[1]!.id,
          expectedRevisionToken: original.revisionToken,
        }),
        setLabel(channel, {
          entityId: agentId,
          label: 'staging',
          versionId: versions[2]!.id,
          expectedRevisionToken: original.revisionToken,
        }),
      ]);

      const fulfilled = results.filter(result => result.status === 'fulfilled');
      const rejected = results.filter(result => result.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      const winner = (fulfilled[0] as PromiseFulfilledResult<VersionLabelPointer<'agent'>>).value;
      const loser = (rejected[0] as PromiseRejectedResult).reason;
      expect(loser).toMatchObject({
        id: 'VERSION_LABEL_CONFLICT',
        details: {
          currentRevisionToken: winner.revisionToken,
          currentVersionId: winner.versionId,
        },
      });
      expect(await getLabel(channel, agentId, 'staging')).toEqual(winner);
    });

    it('prevents ABA token reuse and a stale delete from deleting a recreated label', async () => {
      const { agentId, versions } = await createAgentFixture(storage, { versionCount: 2 });
      const first = await setLabel(channel, {
        entityId: agentId,
        label: 'staging',
        versionId: versions[0]!.id,
        expectedRevisionToken: null,
      });
      const second = await setLabel(channel, {
        entityId: agentId,
        label: 'staging',
        versionId: versions[1]!.id,
        expectedRevisionToken: first.revisionToken,
      });
      const third = await setLabel(channel, {
        entityId: agentId,
        label: 'staging',
        versionId: versions[0]!.id,
        expectedRevisionToken: second.revisionToken,
      });

      expect(new Set([first.revisionToken, second.revisionToken, third.revisionToken]).size).toBe(3);
      await expect(
        setLabel(channel, {
          entityId: agentId,
          label: 'staging',
          versionId: versions[1]!.id,
          expectedRevisionToken: first.revisionToken,
        }),
      ).rejects.toMatchObject({ id: 'VERSION_LABEL_CONFLICT' });

      await expect(deleteLabel(channel, third)).resolves.toEqual({ deleted: true });
      await expect(deleteLabel(channel, third)).resolves.toEqual({ deleted: false });

      const recreated = await setLabel(channel, {
        entityId: agentId,
        label: 'staging',
        versionId: versions[1]!.id,
        expectedRevisionToken: null,
      });
      expect(recreated.revisionToken).not.toBe(third.revisionToken);

      await expect(deleteLabel(channel, third)).rejects.toMatchObject({
        id: 'VERSION_LABEL_CONFLICT',
        details: { currentRevisionToken: recreated.revisionToken },
      });
      expect(await getLabel(channel, agentId, 'staging')).toEqual(recreated);
    });

    it('resolves custom, production, latest, and exact versions with strict ownership', async () => {
      const first = await createAgentFixture(storage, { versionCount: 3, prefix: 'Resolved agent' });
      const second = await createAgentFixture(storage, { versionCount: 1, prefix: 'Foreign agent' });
      await setLabel(channel, {
        entityId: first.agentId,
        label: 'staging',
        versionId: first.versions[1]!.id,
        expectedRevisionToken: null,
      });

      await expect(storage.getByIdResolved(first.agentId, { label: 'staging' })).resolves.toMatchObject({
        id: first.agentId,
        name: 'Resolved agent v2',
        resolvedVersionId: first.versions[1]!.id,
        selectedVersionLabel: 'staging',
      });
      await expect(storage.getByIdResolved(first.agentId, { label: 'latest' })).resolves.toMatchObject({
        resolvedVersionId: first.versions[2]!.id,
        selectedVersionLabel: 'latest',
      });

      // Default/status resolution retains its compatibility fallback, while
      // production remains strict when no active version exists.
      await expect(storage.getByIdResolved(first.agentId)).resolves.toMatchObject({
        resolvedVersionId: first.versions[2]!.id,
      });
      await expect(storage.getByIdResolved(first.agentId, { label: 'production' })).rejects.toMatchObject({
        id: 'VERSION_LABEL_NOT_FOUND',
      });

      await storage.update({ id: first.agentId, activeVersionId: first.versions[0]!.id, status: 'published' });
      await expect(storage.getByIdResolved(first.agentId, { label: 'production' })).resolves.toMatchObject({
        resolvedVersionId: first.versions[0]!.id,
        selectedVersionLabel: 'production',
      });

      await expect(storage.getByIdResolved(first.agentId, { versionId: second.versions[0]!.id })).rejects.toMatchObject(
        { id: 'VERSION_NOT_OWNED_BY_ENTITY' },
      );
      await expect(
        storage.getByIdResolved(first.agentId, { versionId: `missing-version-${randomUUID()}` }),
      ).rejects.toMatchObject({ id: 'VERSION_NOT_FOUND' });
      await expect(storage.getByIdResolved(first.agentId, { label: 'missing-label' })).rejects.toMatchObject({
        id: 'VERSION_LABEL_NOT_FOUND',
      });

      await storage.update({ id: first.agentId, activeVersionId: `missing-version-${randomUUID()}` });
      await expect(storage.getByIdResolved(first.agentId, { label: 'production' })).rejects.toMatchObject({
        id: 'VERSION_LABEL_INTEGRITY_ERROR',
      });
    });

    it('blocks deletion until every label pointing at a version is removed', async () => {
      const { agentId, versions } = await createAgentFixture(storage, { versionCount: 2 });
      const alpha = await setLabel(channel, {
        entityId: agentId,
        label: 'alpha',
        versionId: versions[0]!.id,
        expectedRevisionToken: null,
      });
      const beta = await setLabel(channel, {
        entityId: agentId,
        label: 'beta',
        versionId: versions[0]!.id,
        expectedRevisionToken: null,
      });

      await expect(storage.deleteVersionsByParentId(agentId)).rejects.toMatchObject({
        id: 'VERSION_IN_USE_BY_LABEL',
      });
      await expect(storage.deleteVersion(versions[0]!.id)).rejects.toMatchObject({ id: 'VERSION_IN_USE_BY_LABEL' });
      expect(await storage.getVersion(versions[0]!.id)).not.toBeNull();
      expect(await storage.getVersion(versions[1]!.id)).not.toBeNull();

      await deleteLabel(channel, alpha);
      await expect(storage.deleteVersion(versions[0]!.id)).rejects.toMatchObject({ id: 'VERSION_IN_USE_BY_LABEL' });

      await deleteLabel(channel, beta);
      await expect(storage.deleteVersion(versions[0]!.id)).resolves.toBeUndefined();
      expect(await storage.getVersion(versions[0]!.id)).toBeNull();
      expect(await storage.getVersion(versions[1]!.id)).not.toBeNull();
    });

    it('atomically arbitrates label creation against target-version deletion', async () => {
      const { agentId, versions } = await createAgentFixture(storage, { versionCount: 1 });
      const versionId = versions[0]!.id;

      const [labelResult, deletionResult] = await Promise.allSettled([
        setLabel(channel, {
          entityId: agentId,
          label: 'staging',
          versionId,
          expectedRevisionToken: null,
        }),
        storage.deleteVersion(versionId),
      ]);

      if (labelResult.status === 'fulfilled') {
        expect(deletionResult.status).toBe('rejected');
        if (deletionResult.status === 'rejected') {
          expect(deletionResult.reason).toMatchObject({ id: 'VERSION_IN_USE_BY_LABEL' });
        }
        expect(await getLabel(channel, agentId, 'staging')).toEqual(labelResult.value);
        expect(await storage.getVersion(versionId)).not.toBeNull();
      } else {
        expect(labelResult.reason).toMatchObject({ id: 'VERSION_NOT_FOUND' });
        expect(deletionResult.status).toBe('fulfilled');
        expect(await getLabel(channel, agentId, 'staging')).toBeNull();
        expect(await storage.getVersion(versionId)).toBeNull();
      }
    });

    it('moves retention protection from the old target to the new target', async () => {
      const { agentId, versions } = await createAgentFixture(storage, { versionCount: 2 });
      const original = await setLabel(channel, {
        entityId: agentId,
        label: 'staging',
        versionId: versions[0]!.id,
        expectedRevisionToken: null,
      });
      await setLabel(channel, {
        entityId: agentId,
        label: 'staging',
        versionId: versions[1]!.id,
        expectedRevisionToken: original.revisionToken,
      });

      await expect(storage.deleteVersion(versions[0]!.id)).resolves.toBeUndefined();
      await expect(storage.deleteVersion(versions[1]!.id)).rejects.toMatchObject({ id: 'VERSION_IN_USE_BY_LABEL' });
      expect(
        await channel.listByVersion({ entityType: 'agent', entityId: agentId, versionId: versions[0]!.id }),
      ).toEqual([]);
      expect(
        (await channel.listByVersion({ entityType: 'agent', entityId: agentId, versionId: versions[1]!.id })).map(
          pointer => pointer.label,
        ),
      ).toEqual(['staging']);
    });

    it('deletes all labels for an entity without deleting its versions', async () => {
      const { agentId, versions } = await createAgentFixture(storage, { versionCount: 2 });
      await setLabel(channel, {
        entityId: agentId,
        label: 'alpha',
        versionId: versions[0]!.id,
        expectedRevisionToken: null,
      });
      await setLabel(channel, {
        entityId: agentId,
        label: 'beta',
        versionId: versions[1]!.id,
        expectedRevisionToken: null,
      });

      await expect(
        channel.deleteByEntity({ entityType: 'workflow' as 'agent', entityId: agentId }),
      ).rejects.toMatchObject({ id: 'VERSION_LABELS_UNSUPPORTED' });
      expect((await channel.list({ entityType: 'agent', entityId: agentId, perPage: false })).labels).toHaveLength(2);

      await expect(channel.deleteByEntity({ entityType: 'agent', entityId: agentId })).resolves.toBe(2);
      await expect(channel.deleteByEntity({ entityType: 'agent', entityId: agentId })).resolves.toBe(0);
      expect((await channel.list({ entityType: 'agent', entityId: agentId, perPage: false })).labels).toEqual([]);
      expect(await storage.countVersions(agentId)).toBe(2);
    });

    it('cascades labels on whole-agent deletion without affecting another agent', async () => {
      const first = await createAgentFixture(storage, { versionCount: 2 });
      const second = await createAgentFixture(storage, { versionCount: 1 });
      await setLabel(channel, {
        entityId: first.agentId,
        label: 'staging',
        versionId: first.versions[0]!.id,
        expectedRevisionToken: null,
      });
      const survivor = await setLabel(channel, {
        entityId: second.agentId,
        label: 'staging',
        versionId: second.versions[0]!.id,
        expectedRevisionToken: null,
      });

      await storage.delete(first.agentId);

      expect(await storage.getById(first.agentId)).toBeNull();
      expect(await storage.countVersions(first.agentId)).toBe(0);
      expect(await getLabel(channel, first.agentId, 'staging')).toBeNull();
      expect((await channel.list({ entityType: 'agent', entityId: first.agentId, perPage: false })).labels).toEqual([]);
      expect(await getLabel(channel, second.agentId, 'staging')).toEqual(survivor);
      expect(await storage.getVersion(second.versions[0]!.id)).not.toBeNull();
    });
  });
}
