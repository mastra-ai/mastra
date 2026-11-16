/**
 * Factories created before the unread columns were retired still have them,
 * several as NOT NULL without a default. The current code no longer writes
 * them, so booting on such a database must stop requiring them, keep the
 * values already stored, and let every write that used to fill them succeed.
 */

import { randomUUID } from 'node:crypto';

import type { CollectionColumnSpec, CollectionSchema, FactoryStorage } from '@mastra/core/storage';
import { LibSQLFactoryStorage } from '@mastra/libsql';
import { describe, expect, it, vi } from 'vitest';

import {
  createFactoryStorageForTests,
  createIsolatedFactoryPostgresForTests,
  createLegacyCardTablesForTests,
  createLegacyIntakeTablesForTests,
} from './test-utils.js';

const postgresUrl = process.env.FACTORY_TEST_POSTGRES_URL;
const NOW = new Date('2030-01-01T00:00:00.000Z');
const SCOPE = { orgId: 'org-1', factoryProjectId: 'project-1' };

/** The retired columns, declared as the previous release declared them. */
const RETIRED: Record<string, Record<string, CollectionColumnSpec>> = {
  factory_rule_ingress: { trigger_type: { type: 'text' }, transition_id: { type: 'text' } },
  factory_rule_evaluations: {
    work_item_id: { type: 'text', nullable: true },
    rule_set_version: { type: 'text' },
    expected_revision: { type: 'integer', nullable: true },
    outcome: { type: 'text' },
    code: { type: 'text', nullable: true },
    reason: { type: 'text', nullable: true },
    causal_chain: { type: 'json' },
  },
  factory_deferred_decisions: { effect_ordinal: { type: 'integer' }, effect_hash: { type: 'text' } },
  factory_tool_result_cursors: { last_message_id: { type: 'text' } },
  factory_pending_starts: {
    last_error: { type: 'text', nullable: true },
    failure_code: { type: 'text', nullable: true },
    completed_at: { type: 'timestamp', nullable: true },
  },
  factory_project_repositories: {
    created_by_user_id: { type: 'text' },
    sandbox_provider: { type: 'text' },
    sandbox_workdir: { type: 'text' },
    last_built_at: { type: 'timestamp', nullable: true },
  },
  factory_projects: {
    slack_work_items_enabled: { type: 'boolean', default: false },
    auto_approve_plans: { type: 'boolean', default: false },
    review_test_checks_enabled: { type: 'boolean', default: false },
  },
  integration_subscriptions: { session_scope: { type: 'text', nullable: true } },
  intake_source_bindings: { board: { type: 'text', nullable: true } },
  intake_source_subscriptions: { board: { type: 'text', nullable: true } },
  factory_intake_routes: { allow_working_phase: { type: 'boolean', nullable: true } },
};

/** Every collection the current domains declare on an upgraded database, with the retired columns put back. */
async function previousReleaseSchemas(): Promise<CollectionSchema[]> {
  const probe = new LibSQLFactoryStorage({ id: `retired-probe-${randomUUID()}`, url: ':memory:' });
  const declared = vi.spyOn(probe, 'ensureCollections');
  // The previous release also had the carry-forward tables, which only an upgraded database still registers.
  await createLegacyCardTablesForTests(probe);
  await createLegacyIntakeTablesForTests(probe);
  await createFactoryStorageForTests(probe);
  const schemas = declared.mock.calls.flatMap(([batch]) => batch);
  expect(schemas.map(schema => schema.name)).toEqual(expect.arrayContaining(Object.keys(RETIRED)));
  return schemas.map(schema => ({ ...schema, columns: { ...schema.columns, ...RETIRED[schema.name] } }));
}

describe.each(['libsql', ...(postgresUrl ? ['postgres'] : [])])(
  'a factory database from before the retired columns on %s',
  backend => {
    it('boots, keeps stored values, and accepts every write that used to fill the retired columns', async () => {
      const legacy = await previousReleaseSchemas();
      const storage: FactoryStorage =
        backend === 'postgres'
          ? await createIsolatedFactoryPostgresForTests(postgresUrl!)
          : new LibSQLFactoryStorage({ id: `retired-columns-${randomUUID()}`, url: ':memory:' });
      await storage.ensureCollections(legacy);
      const oldLink = await storage.ops.insertOne<{ id: string }>('factory_project_repositories', {
        connection_id: 'old-connection',
        repository_id: 'old-repository',
        created_by_user_id: 'user-0',
        branch: null,
        sandbox_provider: 'local',
        sandbox_workdir: '/workspace/old',
        setup_command: null,
        teardown_command: null,
        last_built_at: NOW,
        created_at: NOW,
        updated_at: NOW,
      });

      const seed = await createFactoryStorageForTests(storage);

      // factory_project_repositories: created_by_user_id, sandbox_provider, sandbox_workdir
      const project = await seed.projects.create({ orgId: SCOPE.orgId, userId: 'user-1', input: { name: 'Old' } });
      const github = seed.sourceControl.forIntegration('github');
      const installation = await github.installations.upsert({
        orgId: SCOPE.orgId,
        connectedByUserId: 'user-1',
        externalId: 'installation-1',
        accountName: 'acme',
      });
      const repository = await github.repositories.upsert({
        orgId: SCOPE.orgId,
        input: { installationId: installation.id, externalId: 'repo-1', slug: 'acme/api', defaultBranch: 'main' },
      });
      const connection = await github.connections.create({
        orgId: SCOPE.orgId,
        factoryProjectId: project.id,
        installationId: installation.id,
        createdByUserId: 'user-1',
      });
      const link = await github.projectRepositories.link({
        orgId: SCOPE.orgId,
        connectionId: connection.id,
        repositoryId: repository.id,
      });
      await expect(
        github.projectRepositories.setBuildStatus({ orgId: SCOPE.orgId, id: link.id, status: 'configured' }),
      ).resolves.toMatchObject({ lastBuildStatus: 'configured' });

      // factory_rule_ingress, factory_rule_evaluations, factory_deferred_decisions
      const { workItems } = seed;
      const { item } = await workItems.upsert({
        ...SCOPE,
        userId: 'user-1',
        input: { title: 'Fix login', stages: ['intake'], sessions: {}, metadata: {} },
      });
      await expect(
        workItems.commitRuleEvaluation({
          ...SCOPE,
          workItemId: item.id,
          ingress: { identity: 'ingress-1' },
          expectedRevision: item.revision,
          actor: { type: 'system', id: 'rules' },
          outcome: { status: 'accepted' },
          decisions: [{ type: 'invokeSkill', role: 'triage', skillName: 'factory-triage', idempotencyKey: 'triage' }],
          causalChain: [],
          now: NOW,
        }),
      ).resolves.toMatchObject({ status: 'committed' });
      const [decision] = await workItems.listDeferredDecisions(SCOPE.orgId, SCOPE.factoryProjectId);
      expect(decision).toMatchObject({
        status: 'pending',
        decision: { type: 'invokeSkill', skillName: 'factory-triage' },
      });

      // factory_pending_starts and factory_tool_result_cursors
      const prepared = await workItems.prepareRunStart({
        ...SCOPE,
        userId: 'user-1',
        workItem: { id: item.id, input: { title: 'Fix login', stages: ['execute'], sessions: {}, metadata: {} } },
        role: 'work',
        session: { sessionId: 'session-1', branch: 'factory/issue-1', threadId: 'thread-1' },
        resourceId: SCOPE.factoryProjectId,
        kickoffKey: 'kickoff-1',
        kickoffMessage: 'Start.',
      });
      const lease = { ownerId: 'worker-1', now: NOW, leaseExpiresAt: new Date(NOW.getTime() + 30_000), limit: 1 };
      const [start] = await workItems.claimPendingStarts(lease);
      expect(start).toBeDefined();
      await expect(
        workItems.failPendingStart({
          id: start!.id,
          orgId: start!.orgId,
          factoryProjectId: start!.factoryProjectId,
          ownerId: 'worker-1',
          now: NOW,
          availableAt: NOW,
          lastError: 'session unavailable',
          failureCode: 'session_unavailable',
          terminal: false,
        }),
      ).resolves.toMatchObject({ status: 'retry' });
      await workItems.advanceToolResultCursor({
        ...SCOPE,
        bindingId: prepared.binding.id,
        lastMessageCreatedAt: NOW,
        updatedAt: NOW,
      });
      expect(
        await workItems.getToolResultCursor(SCOPE.orgId, SCOPE.factoryProjectId, prepared.binding.id),
      ).toMatchObject({
        lastMessageCreatedAt: NOW,
      });

      // The value stored before the upgrade is still there for a rolled-back build.
      await storage.ensureCollections(legacy.filter(schema => schema.name === 'factory_project_repositories'));
      expect(await storage.ops.findOne('factory_project_repositories', { id: oldLink.id })).toMatchObject({
        created_by_user_id: 'user-0',
        sandbox_provider: 'local',
        sandbox_workdir: '/workspace/old',
      });
      expect(await storage.ops.findOne('factory_project_repositories', { id: link.id })).toMatchObject({
        created_by_user_id: null,
        sandbox_provider: null,
        sandbox_workdir: null,
      });
    });
  },
);
