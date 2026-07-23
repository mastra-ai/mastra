import { EventEmitterPubSub } from '@mastra/core/events';
import { Mastra } from '@mastra/core/mastra';
import { LibSQLFactoryStorage } from '@mastra/libsql';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MastraFactory } from '../../../factory.js';
import { FactoryLinearIssueService } from '../../../rules/linear-service.js';
import type { IntakeStorage } from '../../../storage/domains/intake/base.js';
import type { FactoryProjectsStorage } from '../../../storage/domains/projects/base.js';
import { PlatformLinearIntegration } from './integration.js';
import { encodeSourceId } from './source-id.js';

const harness = vi.hoisted(() => {
  let mastra: Mastra | undefined;
  const controller = {
    id: 'code',
    init: vi.fn(async () => undefined),
    __registerMastra: vi.fn((instance: Mastra) => {
      mastra = instance;
    }),
    getMastra: vi.fn(() => mastra),
  };

  return {
    controller,
    reset() {
      mastra = undefined;
      vi.clearAllMocks();
    },
  };
});

vi.mock('@mastra/code-sdk', () => ({
  prepareAgentControllerMount: vi.fn(async (config: Record<string, unknown>) => {
    const controllerId = String(config.controllerId ?? 'code');
    const controller = harness.controller;
    return {
      base: { controller, authStorage: {} },
      mastraArgs: {
        agentControllers: { [controllerId]: controller },
        storage: config.storage,
        ...(config.pubsub ? { pubsub: config.pubsub } : {}),
      },
      finalize: async () => {
        await controller.init();
        await controller.getMastra()?.startWorkers();
      },
    };
  }),
}));

function json(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv('MASTRA_SHARED_API_URL', 'https://platform.example.com/v1');
  vi.stubEnv('MASTRA_PLATFORM_SECRET_KEY', 'platform-token');
  vi.stubEnv('MASTRA_PLATFORM_GITHUB_POLLING_ENABLED', 'false');
  vi.stubEnv('MASTRA_PLATFORM_LINEAR_POLLING_INTERVAL_MS', '60000');
  harness.reset();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('Platform Linear event worker factory lifecycle', () => {
  it('starts through MastraFactory and sends a selected workspace issue to every Factory project', async () => {
    const storage = new LibSQLFactoryStorage({ url: ':memory:', id: 'platform-linear-worker-lifecycle' });
    const pubsub = new EventEmitterPubSub();
    const ingestLinearIssues = vi.spyOn(FactoryLinearIssueService.prototype, 'ingest').mockResolvedValue({
      status: 'committed',
      ingested: 1,
    });
    const releaseLease = vi.spyOn(pubsub, 'releaseLease');
    const issue = {
      id: 'issue-1',
      identifier: 'ENG-42',
      number: 42,
      title: 'Fix intake',
      description: 'Issue body',
      url: 'https://linear.app/acme/issue/ENG-42',
      priority: 2,
      priorityLabel: 'High',
      labels: [{ id: 'label-1', name: 'bug' }],
      state: { id: 'state-1', name: 'Todo', type: 'unstarted' },
      team: { id: 'team-1', key: 'ENG', name: 'Engineering' },
      assignee: null,
      creator: null,
      createdAt: '2026-07-01T00:00:00Z',
      updatedAt: '2026-07-02T00:00:00Z',
      archivedAt: null,
    };
    const fetchImpl = vi.fn<typeof fetch>(async input => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/linear/workspaces/workspace-1/events')) {
        return json({
          events: [
            {
              id: '1001-0',
              timestamp: Date.now(),
              envelope: {
                type: 'Issue',
                action: 'update',
                data: { id: issue.id, projectId: 'linear-project-1' },
              },
            },
          ],
        });
      }
      if (url.pathname.endsWith('/linear/workspaces/workspace-1/issues/issue-1')) return json(issue);
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchImpl);
    const linear = new PlatformLinearIntegration();
    const factory = new MastraFactory({ storage, pubsub, integrations: [linear] });

    try {
      const args = await factory.prepare();
      const worker = Array.isArray(args.workers)
        ? args.workers.find(candidate => candidate.name === 'platform-linear-events')
        : undefined;
      expect(worker?.name).toBe('platform-linear-events');
      expect(worker?.isRunning).toBe(false);

      const intake = storage.getDomain<IntakeStorage>('intake');
      await intake.saveConfig({
        orgId: 'org-1',
        userId: 'user-1',
        config: { linear: { enabled: true, sourceIds: [encodeSourceId('workspace-1', 'linear-project-1')] } },
      });
      const projects = storage.getDomain<FactoryProjectsStorage>('projects');
      const first = await projects.create({ orgId: 'org-1', userId: 'owner-1', input: { name: 'First' } });
      const second = await projects.create({ orgId: 'org-1', userId: 'owner-2', input: { name: 'Second' } });

      const mastra = new Mastra(args);
      await factory.finalize();
      expect(worker?.isRunning).toBe(true);

      await vi.waitFor(() => expect(ingestLinearIssues).toHaveBeenCalledTimes(2));
      expect(ingestLinearIssues).toHaveBeenCalledWith({
        orgId: 'org-1',
        userId: 'owner-1',
        factoryProjectId: first.id,
        issues: [
          expect.objectContaining({
            id: issue.id,
            identifier: issue.identifier,
            team: 'ENG',
            priorityLabel: 'High',
          }),
        ],
      });
      expect(ingestLinearIssues).toHaveBeenCalledWith({
        orgId: 'org-1',
        userId: 'owner-2',
        factoryProjectId: second.id,
        issues: [expect.objectContaining({ id: issue.id })],
      });
      expect(await pubsub.getLeaseOwner('platform-linear-events:linear')).toEqual(expect.any(String));

      await mastra.stopWorkers();

      expect(worker?.isRunning).toBe(false);
      expect(releaseLease).toHaveBeenCalledOnce();
      expect(await pubsub.getLeaseOwner('platform-linear-events:linear')).toBeUndefined();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      await harness.controller.getMastra()?.stopWorkers();
      await storage.close();
    }
  });
});
