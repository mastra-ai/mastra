import { Mastra } from '@mastra/core/mastra';
import { PubSub } from '@mastra/core/events';
import type { EventCallback, SubscribeOptions } from '@mastra/core/events';
import { LibSQLStore } from '@mastra/libsql';
import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { startServerRuntime } from '../../src/workers/runtime.js';
import { createLibSqlOperationalStore } from '../../src/db/libsql-operational-store.js';
import type { OperationalStore } from '../../src/db/operational-store.js';
import { testWorkflow } from '../helpers/test-workflow.js';
import { createSecurityIncidentWorkflow } from '../../src/mastra/workflows/security-incident-workflow.js';
import { makeServerConfig } from '../fixtures/alert-intake.js';
import { readIntegrationConfig } from '../../src/env.js';
import { retentionIntervalMs } from '../../src/config/retention.js';
import { createTempDatabase, type TempDatabase } from '../helpers/temp-libsql.js';
import { stagingIpinfoEnvironment } from '../fixtures/integrations.js';

const databases: TempDatabase[] = [];

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(databases.splice(0).map(database => database.cleanup()));
});

describe('server lifecycle', () => {
  it.each(['staging', 'production'] as const)('keeps the generic API closed in %s without integrations', async mode => {
    const database = await createTempDatabase();
    databases.push(database);
    const workflow = createSecurityIncidentWorkflow(() => database.createStore());
    const mastra = new Mastra({
      storage: new LibSQLStore({ id: `hosted-${mode}`, url: database.url }),
      workflows: { securityIncidentWorkflow: workflow },
    });
    const statuses: number[] = [];
    const runtime = await startServerRuntime({
      config: makeServerConfig({ mode, webhooksEnabled: false }),
      integrationConfig: readIntegrationConfig({ RUNTIME_MODE: mode }),
      store: database.createStore(),
      mastraInstance: mastra,
      logger: { write: () => {} },
      bindServer: async fetch => {
        for (const path of ['/api/workflows', '/api/agents', '/api/tools']) {
          statuses.push((await fetch(new Request(`http://local${path}`))).status);
        }
        expect((await fetch(new Request('http://local/health'))).status).toBe(200);
        return { port: 43210, close: async () => {} };
      },
    });
    await runtime.stop();
    expect(statuses).toEqual([401, 401, 401]);
  });

  it('keeps domain delivery off the Mastra orchestration transport', async () => {
    const database = await createTempDatabase();
    databases.push(database);
    const workflow = createSecurityIncidentWorkflow(() => createLibSqlOperationalStore({ url: database.url }));
    const mastra = new Mastra({
      storage: new LibSQLStore({
        id: 'lifecycle-domain-events',
        url: database.url,
      }),
      workflows: { testWorkflow, securityIncidentWorkflow: workflow },
    });
    class DomainPubSub extends PubSub {
      subscriptions: Array<Readonly<{ topic: string; group?: string }>> = [];
      closed = false;
      flushed = false;
      override async publish(): Promise<void> {}
      override async subscribe(topic: string, _callback: EventCallback, options?: SubscribeOptions): Promise<void> {
        this.subscriptions.push({
          topic,
          ...(options?.group ? { group: options.group } : {}),
        });
      }
      override async unsubscribe(): Promise<void> {}
      override async flush(): Promise<void> {
        this.flushed = true;
      }
      async close(): Promise<void> {
        this.closed = true;
      }
    }
    const domainEventPubSub = new DomainPubSub();
    const runtime = await startServerRuntime({
      config: makeServerConfig({
        outbox: { ...makeServerConfig().outbox, pollIntervalMs: 60_000 },
      }),
      store: database.createStore(),
      mastraInstance: mastra,
      domainEventPubSub,
      logger: { write: () => {} },
      port: 0,
      bindServer: async () => ({ port: 43_212, close: async () => {} }),
    });

    expect(domainEventPubSub.subscriptions).toEqual([
      {
        topic: 'security.alert.received',
        group: 'security-workflow-starters',
      },
    ]);
    await runtime.stop();
    expect(domainEventPubSub.flushed).toBe(true);
    expect(domainEventPubSub.closed).toBe(true);
  });

  it('injects the validated integration config into the nominal Hono route without falling back to mock', async () => {
    vi.stubEnv('WORKOS_API_KEY', 'runtime-control-plane-key');
    vi.stubEnv('WORKOS_CLIENT_ID', 'runtime-control-plane-client');
    vi.stubEnv('WORKOS_REDIRECT_URI', 'https://dashboard.example.test/callback');
    vi.stubEnv('WORKOS_COOKIE_PASSWORD', 'x'.repeat(32));
    const database = await createTempDatabase();
    databases.push(database);
    const workflow = createSecurityIncidentWorkflow(() => createLibSqlOperationalStore({ url: database.url }));
    const mastra = new Mastra({
      storage: new LibSQLStore({ id: 'lifecycle-workos', url: database.url }),
      workflows: { testWorkflow, securityIncidentWorkflow: workflow },
    });
    const secret = 'current-workos-webhook-secret';
    const integrationConfig = readIntegrationConfig({
      RUNTIME_MODE: 'staging',
      ...stagingIpinfoEnvironment,
      WEBHOOKS_ENABLED: 'true',
      WORKOS_PROVIDER_ENABLED: 'true',
      WORKOS_API_KEY: 'fake-workos-api-key',
      WORKOS_WEBHOOK_SECRET: secret,
      WORKOS_ORGANIZATION_ID: 'tenant-1',
      WORKOS_ALLOWED_USER_IDS: 'subject-1',
      WORKOS_ALLOWED_ROLE_SLUGS: 'member,admin,viewer',
    });
    const now = Date.now();
    const bytes = new TextEncoder().encode(
      `{ "id":"runtime-workos-1", "event":"organization_membership.updated", "created_at":"${new Date().toISOString()}", "data": { "object":"organization_membership", "id":"membership-runtime-1", "organization_id":"tenant-1", "organization_name":"Synthetic", "user_id":"subject-1", "status":"active", "directory_managed":false, "created_at":"${new Date().toISOString()}", "updated_at":"${new Date().toISOString()}", "custom_attributes":{}, "role":{"slug":"admin"} } }`,
    );
    const signature = createHmac('sha256', secret).update(`${now}.`, 'utf8').update(bytes).digest('hex');
    let nominalStatus = 0;
    let mockStatus = 0;
    const genericControlPlaneStatuses: number[] = [];
    const runtime = await startServerRuntime({
      config: makeServerConfig({
        outbox: { ...makeServerConfig().outbox, pollIntervalMs: 60_000 },
      }),
      integrationConfig,
      store: database.createStore(),
      mastraInstance: mastra,
      logger: { write: () => {} },
      port: 0,
      bindServer: async fetch => ({
        port: 43_211,
        close: async () => {
          nominalStatus = (
            await fetch(
              new Request('http://local/webhooks/workos', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'WorkOS-Signature': `t=${now},v1=${signature}`,
                },
                body: bytes,
              }),
            )
          ).status;
          mockStatus = (
            await fetch(
              new Request('http://local/webhooks/workos/mock', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'WorkOS-Signature': `t=${now},v1=${signature}`,
                },
                body: bytes,
              }),
            )
          ).status;
          for (const path of [
            '/api/workflows',
            '/api/workflows/securityIncidentWorkflow/runs',
            '/api/agents/socSupervisor/tools',
          ])
            genericControlPlaneStatuses.push((await fetch(new Request(`http://local${path}`))).status);
        },
      }),
    });
    await runtime.stop();
    expect(nominalStatus).toBe(202);
    expect(mockStatus).toBe(404);
    expect(genericControlPlaneStatuses).toEqual([401, 401, 401]);
  });

  it('starts in the required order and stops idempotently without an owned timer', async () => {
    const database = await createTempDatabase();
    databases.push(database);
    const workflow = createSecurityIncidentWorkflow(() => createLibSqlOperationalStore({ url: database.url }));
    const storage = new LibSQLStore({
      id: 'lifecycle-test',
      url: database.url,
    });
    const mastra = new Mastra({
      storage,
      workflows: {
        testWorkflow,
        securityIncidentWorkflow: workflow,
      },
    });
    const startupOrder: string[] = [];
    const runtime = await startServerRuntime({
      config: makeServerConfig({
        outbox: {
          ...makeServerConfig().outbox,
          pollIntervalMs: 60_000,
        },
      }),
      store: database.createStore(),
      mastraInstance: mastra,
      initializeStorage: async () => {
        startupOrder.push('storage.init');
      },
      logger: { write: () => {} },
      port: 0,
      bindServer: async fetch => ({
        port: 43_210,
        close: async () => {
          const response = await fetch(new Request('http://local/health'));
          expect(response.status).toBe(200);
        },
      }),
    });
    expect(startupOrder).toEqual(['storage.init']);
    expect(runtime.port).toBe(43_210);
    await runtime.stop();
    await runtime.stop();
  });

  it('runs the explicitly scoped retention scheduler in the runtime lifecycle', async () => {
    const database = await createTempDatabase();
    databases.push(database);
    const workflow = createSecurityIncidentWorkflow(() => createLibSqlOperationalStore({ url: database.url }));
    const mastra = new Mastra({
      storage: new LibSQLStore({
        id: 'retention-lifecycle',
        url: database.url,
      }),
      workflows: {
        testWorkflow,
        securityIncidentWorkflow: workflow,
      },
    });
    const runtime = await startServerRuntime({
      config: makeServerConfig({
        outbox: { ...makeServerConfig().outbox, pollIntervalMs: 60_000 },
      }),
      retentionConfig: {
        enabled: true,
        tenantId: 'tenant-a',
        limit: 8,
        maxBatchesPerRun: 1,
        intervalMs: retentionIntervalMs,
      },
      store: database.createStore(),
      mastraInstance: mastra,
      logger: { write: () => {} },
      port: 0,
      bindServer: async () => ({ port: 43_209, close: async () => {} }),
    });
    await expect(
      database.createStore().execute({
        sql: "SELECT next_source FROM retention_source_cursors WHERE tenant_id='tenant-a'",
      }),
    ).resolves.toMatchObject({
      rows: [{ next_source: 1 }],
    });
    await runtime.stop();
  });

  it('rejects every late runtime configuration before storage initialization or SQL', async () => {
    const integrationConfig = readIntegrationConfig({ RUNTIME_MODE: 'local' });
    const approvalConfig = {
      mode: 'local' as const,
      localApprovalsEnabled: false,
      actionTimeoutMs: 1_000,
      rateLimit: 8,
    };
    const dashboardConfig = {
      enabled: false,
      dashboardOrigin: 'http://localhost:3000',
      sessionMaxAgeSeconds: 28_800,
      sseMaxConnections: 4,
      trustedProxy: false,
    };
    const disabledRetention = {
      enabled: false,
      intervalMs: retentionIntervalMs,
    } as const;
    for (const invalid of [
      {
        name: 'investigation',
        setup: () => vi.stubEnv('MASTRA_MODEL', ' '),
        overrides: {
          approvalConfig,
          dashboardConfig,
          retentionConfig: disabledRetention,
        },
      },
      {
        name: 'response',
        setup: () => vi.stubEnv('LOCAL_APPROVALS_ENABLED', 'true'),
        overrides: { dashboardConfig, retentionConfig: disabledRetention },
      },
      {
        name: 'dashboard',
        setup: () => vi.stubEnv('DASHBOARD_AUTH_ENABLED', 'true'),
        overrides: { approvalConfig, retentionConfig: disabledRetention },
      },
      {
        name: 'retention',
        setup: () => {
          vi.stubEnv('RETENTION_SCHEDULER_ENABLED', 'true');
          vi.stubEnv('RETENTION_TENANT_ID', 'tenant-a');
          vi.stubEnv('RETENTION_SWEEP_LIMIT', '8');
        },
        overrides: { approvalConfig, dashboardConfig },
      },
    ]) {
      vi.unstubAllEnvs();
      invalid.setup();
      const initializeStorage = vi.fn();
      const execute = vi.fn();
      const loadMastraRuntime = vi.fn();
      await expect(
        startServerRuntime({
          config: makeServerConfig(),
          integrationConfig,
          store: { execute } as unknown as OperationalStore,
          initializeStorage,
          loadMastraRuntime,
          ...invalid.overrides,
        }),
      ).rejects.toThrow();
      expect(initializeStorage, invalid.name).not.toHaveBeenCalled();
      expect(execute, invalid.name).not.toHaveBeenCalled();
      expect(loadMastraRuntime, invalid.name).not.toHaveBeenCalled();
    }
  });

  it('validates server and integration configuration before storage or SQL', async () => {
    for (const setup of [
      () => {
        vi.stubEnv('WEBHOOKS_ENABLED', 'true');
        vi.stubEnv('ALERT_WEBHOOK_SECRET', ` ${'a'.repeat(16)}`);
        vi.stubEnv('WORKOS_WEBHOOK_SECRET', 'b'.repeat(16));
      },
      () => {
        vi.stubEnv('IPINFO_PROVIDER_ENABLED', 'true');
        vi.stubEnv('IPINFO_TOKEN', 'incomplete-token');
      },
    ]) {
      vi.unstubAllEnvs();
      setup();
      const initializeStorage = vi.fn();
      const execute = vi.fn();
      await expect(
        startServerRuntime({
          store: { execute } as unknown as OperationalStore,
          initializeStorage,
        }),
      ).rejects.toThrow();
      expect(initializeStorage).not.toHaveBeenCalled();
      expect(execute).not.toHaveBeenCalled();
    }
  });
});
