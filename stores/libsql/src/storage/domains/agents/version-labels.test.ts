import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createClient } from '@libsql/client';
import { TABLE_AGENTS, TABLE_VERSION_LABELS } from '@mastra/core/storage';
import { afterEach, describe, expect, it } from 'vitest';

import { AgentsLibSQL } from '.';

const testDirectories: string[] = [];

function createVersionLabelTestUrl() {
  const directory = mkdtempSync(join(tmpdir(), 'mastra-libsql-version-labels-'));
  testDirectories.push(directory);
  return `file:${join(directory, 'test.db')}`;
}

function createVersionLabelTestClient() {
  return createClient({ url: createVersionLabelTestUrl() });
}

afterEach(() => {
  for (const directory of testDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

async function createAgentWithVersions(storage: AgentsLibSQL, agentId: string) {
  await storage.create({
    agent: {
      id: agentId,
      name: `Agent ${agentId}`,
      instructions: 'Test instructions',
      model: { provider: 'openai', name: 'gpt-4' },
    },
  });
  const firstVersion = (await storage.listVersions({ agentId, perPage: false })).versions[0]!;
  const secondVersion = await storage.createVersion({
    id: crypto.randomUUID(),
    agentId,
    versionNumber: 2,
    name: `Agent ${agentId} v2`,
    instructions: 'Updated test instructions',
    model: { provider: 'openai', name: 'gpt-4' },
  });
  return { firstVersion, secondVersion };
}

describe('AgentsLibSQL version labels', () => {
  it('adds the normalized label table, composite key, and reverse index idempotently', async () => {
    const client = createVersionLabelTestClient();
    try {
      const storage = new AgentsLibSQL({ client });
      await storage.init();
      await storage.init();

      const tableInfo = await client.execute(`PRAGMA table_info("${TABLE_VERSION_LABELS}")`);
      const primaryKey = tableInfo.rows
        .filter(row => Number(row.pk) > 0)
        .sort((left, right) => Number(left.pk) - Number(right.pk))
        .map(row => row.name);
      expect(primaryKey).toEqual(['entityType', 'entityId', 'label']);

      const reverseIndex = await client.execute({
        sql: `SELECT "sql" FROM sqlite_master WHERE "type" = 'index' AND "name" = ?`,
        args: ['idx_version_labels_entity_version'],
      });
      expect(reverseIndex.rows).toHaveLength(1);
      expect(reverseIndex.rows[0]?.sql).toContain('"entityType", "entityId", "versionId"');

      const globalTargetIndex = await client.execute({
        sql: `SELECT "sql" FROM sqlite_master WHERE "type" = 'index' AND "name" = ?`,
        args: ['idx_version_labels_version'],
      });
      expect(globalTargetIndex.rows).toHaveLength(1);
      expect(globalTargetIndex.rows[0]?.sql).toContain('"entityType", "versionId"');
    } finally {
      client.close();
    }
  });

  it('persists labels and their revision tokens through a fresh store instance', async () => {
    const url = createVersionLabelTestUrl();
    const seeded = await (async () => {
      const client = createClient({ url });
      try {
        const storage = new AgentsLibSQL({ client });
        await storage.init();
        const { firstVersion } = await createAgentWithVersions(storage, 'agent-reopen');
        const pointer = await storage.versionLabels.set({
          entityType: 'agent',
          entityId: 'agent-reopen',
          label: 'staging',
          versionId: firstVersion.id,
          expectedRevisionToken: null,
        });
        return { pointer, versionId: firstVersion.id };
      } finally {
        client.close();
      }
    })();

    const reopenedClient = createClient({ url });
    try {
      const reopened = new AgentsLibSQL({ client: reopenedClient });
      await reopened.init();
      await expect(
        reopened.versionLabels.get({ entityType: 'agent', entityId: 'agent-reopen', label: 'staging' }),
      ).resolves.toMatchObject({
        versionId: seeded.versionId,
        revisionToken: seeded.pointer.revisionToken,
      });
      await expect(reopened.getByIdResolved('agent-reopen', { label: 'staging' })).resolves.toMatchObject({
        resolvedVersionId: seeded.versionId,
        selectedVersionLabel: 'staging',
      });
    } finally {
      reopenedClient.close();
    }
  });

  it('performs deterministic reads and compare-and-swap mutations', async () => {
    const client = createVersionLabelTestClient();
    try {
      const storage = new AgentsLibSQL({ client });
      await storage.init();
      const { firstVersion, secondVersion } = await createAgentWithVersions(storage, 'agent-cas');
      const labels = storage.versionLabels;

      const created = await labels.set({
        entityType: 'agent',
        entityId: 'agent-cas',
        label: 'beta',
        versionId: firstVersion.id,
        expectedRevisionToken: null,
      });
      const idempotent = await labels.set({
        entityType: 'agent',
        entityId: 'agent-cas',
        label: 'beta',
        versionId: firstVersion.id,
        expectedRevisionToken: 'stale-token',
      });
      expect(idempotent).toEqual(created);

      const moved = await labels.set({
        entityType: 'agent',
        entityId: 'agent-cas',
        label: 'beta',
        versionId: secondVersion.id,
        expectedRevisionToken: created.revisionToken,
      });
      expect(moved.revisionToken).not.toBe(created.revisionToken);
      expect(moved.createdAt).toEqual(created.createdAt);

      await labels.set({
        entityType: 'agent',
        entityId: 'agent-cas',
        label: 'alpha',
        versionId: secondVersion.id,
        expectedRevisionToken: null,
      });
      const page = await labels.list({ entityType: 'agent', entityId: 'agent-cas', page: 0, perPage: 1 });
      expect(page.labels.map(pointer => pointer.label)).toEqual(['alpha']);
      expect(page).toMatchObject({ total: 2, page: 0, perPage: 1, hasMore: true });
      expect(
        (await labels.listByVersion({ entityType: 'agent', entityId: 'agent-cas', versionId: secondVersion.id })).map(
          pointer => pointer.label,
        ),
      ).toEqual(['alpha', 'beta']);

      await expect(
        labels.delete({
          entityType: 'agent',
          entityId: 'agent-cas',
          label: 'beta',
          expectedRevisionToken: created.revisionToken,
        }),
      ).rejects.toMatchObject({ id: 'VERSION_LABEL_CONFLICT' });
    } finally {
      client.close();
    }
  });

  it('validates ownership, protects target versions, and cascades whole-agent deletion', async () => {
    const client = createVersionLabelTestClient();
    try {
      const storage = new AgentsLibSQL({ client });
      await storage.init();
      const first = await createAgentWithVersions(storage, 'agent-one');
      const second = await createAgentWithVersions(storage, 'agent-two');
      const labels = storage.versionLabels;

      await expect(
        labels.set({
          entityType: 'agent',
          entityId: 'agent-one',
          label: 'wrong-owner',
          versionId: second.firstVersion.id,
          expectedRevisionToken: null,
        }),
      ).rejects.toMatchObject({ id: 'VERSION_NOT_OWNED_BY_ENTITY' });

      await labels.set({
        entityType: 'agent',
        entityId: 'agent-one',
        label: 'protected',
        versionId: first.secondVersion.id,
        expectedRevisionToken: null,
      });
      await expect(storage.deleteVersion(first.secondVersion.id)).rejects.toMatchObject({
        id: 'VERSION_IN_USE_BY_LABEL',
      });
      expect(await storage.getVersion(first.secondVersion.id)).not.toBeNull();

      await storage.delete('agent-one');
      expect(await storage.getById('agent-one')).toBeNull();
      expect(await storage.getVersion(first.secondVersion.id)).toBeNull();
      expect(await labels.list({ entityType: 'agent', entityId: 'agent-one', perPage: false })).toMatchObject({
        labels: [],
        total: 0,
      });
    } finally {
      client.close();
    }
  });

  it('retries a cross-client label mutation after transient write contention', async () => {
    const url = createVersionLabelTestUrl();
    const blockerClient = createClient({ url });
    const storageClient = createClient({ url });
    let blockerTransaction: Awaited<ReturnType<typeof blockerClient.transaction>> | undefined;
    try {
      const storage = new AgentsLibSQL({
        client: storageClient,
        maxRetries: 8,
        initialBackoffMs: 10,
      });
      await storage.init();
      const { firstVersion } = await createAgentWithVersions(storage, 'agent-contention');

      blockerTransaction = await blockerClient.transaction('write');
      await blockerTransaction.execute({
        sql: `UPDATE "${TABLE_AGENTS}" SET "updatedAt" = "updatedAt" WHERE "id" = ?`,
        args: ['agent-contention'],
      });

      const assertion = expect(
        storage.versionLabels.set({
          entityType: 'agent',
          entityId: 'agent-contention',
          label: 'staging',
          versionId: firstVersion.id,
          expectedRevisionToken: null,
        }),
      ).resolves.toMatchObject({ label: 'staging', versionId: firstVersion.id });

      await new Promise(resolve => setTimeout(resolve, 100));
      await blockerTransaction.rollback();
      blockerTransaction.close();
      blockerClient.close();
      blockerTransaction = undefined;
      await assertion;
    } finally {
      if (blockerTransaction && !blockerTransaction.closed) await blockerTransaction.rollback();
      blockerClient.close();
      storageClient.close();
    }
  });
});
