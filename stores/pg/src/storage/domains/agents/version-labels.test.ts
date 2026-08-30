import { randomUUID } from 'node:crypto';

import { TABLE_VERSION_LABELS } from '@mastra/core/storage';
import { Pool } from 'pg';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

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
