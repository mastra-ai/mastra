import { randomUUID } from 'node:crypto';

import { TABLE_VERSION_LABELS } from '@mastra/core/storage';
import { Pool } from 'pg';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PostgresStore } from '../..';
import { connectionString, TEST_CONFIG } from '../../test-utils';

describe('AgentsPG version-label durability', () => {
  let adminPool: Pool;
  let schemaName: string;
  let stores: PostgresStore[];

  beforeEach(() => {
    adminPool = new Pool({ connectionString });
    schemaName = `agent_labels_${randomUUID().replace(/-/g, '').slice(0, 8)}`;
    stores = [];
  });

  afterEach(async () => {
    await Promise.allSettled(stores.map(store => store.close()));
    try {
      await adminPool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    } finally {
      await adminPool.end();
    }
  });

  function newStore(id: string): PostgresStore {
    const store = new PostgresStore({ ...TEST_CONFIG, id, schemaName });
    stores.push(store);
    return store;
  }

  it('resolves strict selectors from the writer while ordinary reads use a lagging replica', async () => {
    const readPool = new Pool({ connectionString });
    const readQuery = vi.spyOn(readPool, 'query').mockResolvedValue({
      rows: [],
      rowCount: 0,
      command: 'SELECT',
      oid: 0,
      fields: [],
    });
    const store = new PostgresStore({
      id: 'pg-labels-lagging-replica',
      writePool: adminPool,
      readPool,
      schemaName,
    });
    stores.push(store);

    try {
      await store.init();
      const agents = store.stores.agents;
      if (!agents?.versionLabels) throw new Error('Expected the agent version-label channel');
      const agentId = randomUUID();
      await agents.create({
        agent: {
          id: agentId,
          name: 'Replica-lag label agent',
          instructions: 'Version one',
          model: { provider: 'openai', name: 'gpt-4' },
        },
      });
      const first = await agents.getByIdResolved(agentId, { label: 'latest' });
      if (!first?.resolvedVersionId) throw new Error('Expected the new agent version on the writer');
      const second = await agents.createVersion({
        id: randomUUID(),
        agentId,
        versionNumber: 2,
        name: 'Replica-lag label agent',
        instructions: 'Version two',
        model: { provider: 'openai', name: 'gpt-4' },
      });
      const pointer = await agents.versionLabels.set({
        entityType: 'agent',
        entityId: agentId,
        label: 'candidate',
        versionId: first.resolvedVersionId,
        expectedRevisionToken: null,
      });
      await agents.versionLabels.set({
        entityType: 'agent',
        entityId: agentId,
        label: 'candidate',
        versionId: second.id,
        expectedRevisionToken: pointer.revisionToken,
      });
      await agents.update({ id: agentId, status: 'published', activeVersionId: second.id });

      await expect(agents.getById(agentId)).resolves.toBeNull();
      await expect(agents.getVersion(second.id)).resolves.toBeNull();
      await expect(agents.getLatestVersion(agentId)).resolves.toBeNull();
      await expect(agents.getByIdResolved(agentId, { status: 'published' })).resolves.toBeNull();
      readQuery.mockResolvedValueOnce({
        rows: [{ count: 0 }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });
      await expect(agents.listVersions({ agentId })).resolves.toMatchObject({ versions: [] });
      expect(readQuery).toHaveBeenCalled();
      readQuery.mockClear();

      for (const selector of [
        { versionId: second.id },
        { label: 'candidate' },
        { label: 'production' },
        { label: 'latest' },
      ]) {
        await expect(agents.getByIdResolved(agentId, selector)).resolves.toMatchObject({
          id: agentId,
          resolvedVersionId: second.id,
          instructions: 'Version two',
        });
      }
      await agents.update({ id: agentId, activeVersionId: first.resolvedVersionId });
      await expect(agents.getByIdResolved(agentId, { label: 'production' })).resolves.toMatchObject({
        resolvedVersionId: first.resolvedVersionId,
        instructions: 'Version one',
      });
      expect(readQuery).not.toHaveBeenCalled();
    } finally {
      await store.close();
      await readPool.end();
    }
  });

  it('additively creates label storage and persists CAS state across store instances', async () => {
    const agentId = `agent-${randomUUID()}`;
    const secondVersionId = randomUUID();

    const preMigration = newStore('pg-labels-before-additive-init');
    await preMigration.init();
    const preMigrationAgents = preMigration.stores.agents;
    expect(preMigrationAgents).toBeDefined();
    if (!preMigrationAgents) throw new Error('Expected the agents storage domain');

    await preMigrationAgents.create({
      agent: {
        id: agentId,
        name: 'Persistent label agent',
        instructions: 'Version one',
        model: { provider: 'openai', name: 'gpt-4' },
      },
    });
    const generatedVersion = await preMigrationAgents.getLatestVersion(agentId);
    expect(generatedVersion).not.toBeNull();
    if (!generatedVersion) throw new Error('Expected the generated agent version');
    const firstVersionId = generatedVersion.id;
    await preMigrationAgents.createVersion({
      id: secondVersionId,
      agentId,
      versionNumber: 2,
      name: 'Persistent label agent',
      instructions: 'Version two',
      model: { provider: 'openai', name: 'gpt-4' },
    });

    await adminPool.query(`DROP TABLE "${schemaName}"."${TABLE_VERSION_LABELS}"`);
    const beforeAdditiveInit = await adminPool.query<{ relation: string | null }>(
      'SELECT to_regclass($1) AS relation',
      [`${schemaName}.${TABLE_VERSION_LABELS}`],
    );
    expect(beforeAdditiveInit.rows[0]?.relation).toBeNull();
    await preMigration.close();

    const migrated = newStore('pg-labels-additive-init');
    await migrated.init();
    const migratedAgents = migrated.stores.agents;
    expect(migratedAgents).toBeDefined();
    if (!migratedAgents) throw new Error('Expected the migrated agents storage domain');

    const afterAdditiveInit = await adminPool.query<{ relation: string | null }>('SELECT to_regclass($1) AS relation', [
      `${schemaName}.${TABLE_VERSION_LABELS}`,
    ]);
    expect(afterAdditiveInit.rows[0]?.relation).toBe(`${schemaName}.${TABLE_VERSION_LABELS}`);
    expect(await migratedAgents.getById(agentId)).toMatchObject({ id: agentId });
    expect(await migratedAgents.countVersions(agentId)).toBe(2);

    const labels = migratedAgents.versionLabels;
    expect(labels).toBeDefined();
    if (!labels) throw new Error('Expected the agent version-label channel');
    const created = await labels.set({
      entityType: 'agent',
      entityId: agentId,
      label: 'staging',
      versionId: firstVersionId,
      expectedRevisionToken: null,
    });
    await migrated.close();

    const reopened = newStore('pg-labels-reopened');
    await reopened.init();
    const reopenedAgents = reopened.stores.agents;
    expect(reopenedAgents).toBeDefined();
    if (!reopenedAgents?.versionLabels) throw new Error('Expected the reopened agent version-label channel');

    await expect(
      reopenedAgents.versionLabels.get({ entityType: 'agent', entityId: agentId, label: 'staging' }),
    ).resolves.toEqual(created);
    const moved = await reopenedAgents.versionLabels.set({
      entityType: 'agent',
      entityId: agentId,
      label: 'staging',
      versionId: secondVersionId,
      expectedRevisionToken: created.revisionToken,
    });
    expect(moved.revisionToken).not.toBe(created.revisionToken);
    expect(moved.createdAt).toEqual(created.createdAt);
    await expect(reopenedAgents.getByIdResolved(agentId, { label: 'staging' })).resolves.toMatchObject({
      id: agentId,
      resolvedVersionId: secondVersionId,
      selectedVersionLabel: 'staging',
    });
  });
});
