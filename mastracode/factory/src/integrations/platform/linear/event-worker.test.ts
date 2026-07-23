import type { WorkerDeps } from '@mastra/core/worker';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { IntakeStorage } from '../../../storage/domains/intake/base.js';
import type { FactoryProjectsStorage } from '../../../storage/domains/projects/base.js';
import type { LinearIssueIngress } from '../../base.js';
import { PlatformApiClient } from '../api-client.js';
import { PlatformLinearEventWorker } from './event-worker.js';
import type { PlatformLinearEventStorage } from './event-worker.js';
import { encodeSourceId } from './source-id.js';

const baseUrl = 'https://platform.example.com';
const accessToken = 'platform-token';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

function createSettingsStorage(initial: unknown = null) {
  let value = initial;
  const get = vi.fn(async () => value);
  const save = vi.fn(async (_orgId: string, _userId: string, next: unknown) => {
    value = structuredClone(next);
  });
  return {
    storage: {
      integrationId: 'linear',
      settings: { get, save },
    } as unknown as PlatformLinearEventStorage,
    read: () => value,
  };
}

function createDeps(): WorkerDeps {
  return {
    pubsub: {} as WorkerDeps['pubsub'],
    storage: {} as WorkerDeps['storage'],
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as WorkerDeps['logger'],
  };
}

const issue: LinearIssueIngress = {
  id: 'issue-1',
  identifier: 'ENG-42',
  title: 'Fix intake',
  url: 'https://linear.app/acme/issue/ENG-42',
  state: 'Todo',
  stateType: 'unstarted',
  priorityLabel: 'High',
  assignee: null,
  team: 'ENG',
  labels: ['bug'],
  createdAt: '2026-07-01T00:00:00Z',
  updatedAt: '2026-07-02T00:00:00Z',
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('PlatformLinearEventWorker', () => {
  it('polls selected workspaces, sends matching issues to every Factory project, and resumes from its cursor', async () => {
    const settings = createSettingsStorage();
    const intake = {
      listEnabledSourceSelections: vi.fn(async () => [
        { orgId: 'org-1', userId: 'user-1', sourceIds: [encodeSourceId('workspace-1', 'linear-project-1')] },
        { orgId: 'org-1', userId: 'user-2', sourceIds: [encodeSourceId('workspace-1', 'linear-project-1')] },
      ]),
    } as unknown as IntakeStorage;
    const projects = {
      list: vi.fn(async () => [
        { id: 'factory-1', orgId: 'org-1', createdBy: 'owner-1' },
        { id: 'factory-2', orgId: 'org-1', createdBy: 'owner-2' },
      ]),
    } as unknown as FactoryProjectsStorage;
    const loadIssue = vi.fn(async () => issue);
    const ingestLinearIssues = vi.fn(async () => ({ status: 'committed' }));
    const eventRequests: URL[] = [];
    const fetchImpl = vi.fn<typeof fetch>(async input => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/linear/workspaces/workspace-1/events')) {
        eventRequests.push(url);
        if (url.searchParams.has('after')) {
          return json({
            events: [
              {
                id: '1000-0',
                timestamp: Date.now() - 2_500,
                envelope: {
                  type: 'Issue',
                  action: 'update',
                  data: { id: 'issue-1', projectId: 'linear-project-1' },
                },
              },
              {
                id: '1001-0',
                timestamp: Date.now() - 1_000,
                envelope: {
                  type: 'Issue',
                  action: 'update',
                  data: { id: 'issue-2', projectId: 'unselected-project' },
                },
              },
            ],
          });
        }
        return json({ events: [] });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    const worker = new PlatformLinearEventWorker({
      client: new PlatformApiClient({ baseUrl, accessToken, fetchImpl }),
      intake,
      projects,
      storage: settings.storage,
      loadIssue,
      ingestLinearIssues,
      intervalMs: 1_000,
      now: () => 10_000,
    });
    const deps = createDeps();

    await worker.init(deps);
    await worker.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(eventRequests[0]?.searchParams.get('after')).toBe('9999');
    expect(loadIssue).toHaveBeenCalledOnce();
    expect(loadIssue).toHaveBeenCalledWith('workspace-1', 'issue-1');
    expect(ingestLinearIssues).toHaveBeenCalledTimes(2);
    expect(ingestLinearIssues).toHaveBeenCalledWith({
      orgId: 'org-1',
      userId: 'owner-1',
      factoryProjectId: 'factory-1',
      issues: [issue],
    });
    expect(ingestLinearIssues).toHaveBeenCalledWith({
      orgId: 'org-1',
      userId: 'owner-2',
      factoryProjectId: 'factory-2',
      issues: [issue],
    });
    expect(deps.logger.info).toHaveBeenCalledWith(
      'Platform Linear event received from the Platform event log',
      expect.objectContaining({
        event: 'platform_linear_event_received',
        organizationId: 'org-1',
        workspaceId: 'workspace-1',
        eventId: '1000-0',
        linearEvent: 'Issue',
        action: 'update',
        eventAgeMs: 2_500,
      }),
    );
    expect(settings.read()).toEqual({
      version: 1,
      workspaces: { 'org-1:workspace-1': { afterEventId: '1001-0' } },
    });
    await worker.stop();

    eventRequests.length = 0;
    const resumed = new PlatformLinearEventWorker({
      client: new PlatformApiClient({ baseUrl, accessToken, fetchImpl }),
      intake,
      projects,
      storage: settings.storage,
      loadIssue,
      ingestLinearIssues,
      intervalMs: 1_000,
      now: () => 20_000,
    });
    await resumed.init(createDeps());
    await resumed.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(eventRequests[0]?.searchParams.get('afterEventId')).toBe('1001-0');
    expect(eventRequests[0]?.searchParams.has('after')).toBe(false);
    await resumed.stop();
  });

  it('advances the cursor when one Factory project rejects an event', async () => {
    const settings = createSettingsStorage();
    const intake = {
      listEnabledSourceSelections: vi.fn(async () => [
        { orgId: 'org-1', userId: 'user-1', sourceIds: [encodeSourceId('workspace-1', 'linear-project-1')] },
      ]),
    } as unknown as IntakeStorage;
    const projects = {
      list: vi.fn(async () => [
        { id: 'factory-1', orgId: 'org-1', createdBy: 'owner-1' },
        { id: 'factory-2', orgId: 'org-1', createdBy: 'owner-2' },
      ]),
    } as unknown as FactoryProjectsStorage;
    const ingestLinearIssues = vi
      .fn()
      .mockRejectedValueOnce(new Error('target unavailable'))
      .mockResolvedValue({ status: 'committed' });
    const fetchImpl = vi.fn<typeof fetch>(async input => {
      const url = new URL(String(input));
      if (url.searchParams.has('after')) {
        return json({
          events: [
            {
              id: '1000-0',
              timestamp: Date.now(),
              envelope: {
                type: 'Issue',
                action: 'create',
                data: { id: 'issue-1', projectId: 'linear-project-1' },
              },
            },
          ],
        });
      }
      return json({ events: [] });
    });
    const worker = new PlatformLinearEventWorker({
      client: new PlatformApiClient({ baseUrl, accessToken, fetchImpl }),
      intake,
      projects,
      storage: settings.storage,
      loadIssue: async () => issue,
      ingestLinearIssues,
      intervalMs: 1_000,
      now: () => 10_000,
    });
    const deps = createDeps();

    await worker.init(deps);
    await worker.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(ingestLinearIssues).toHaveBeenCalledTimes(2);
    expect(settings.read()).toEqual({
      version: 1,
      workspaces: { 'org-1:workspace-1': { afterEventId: '1000-0' } },
    });
    expect(deps.logger.error).toHaveBeenCalledWith(
      'Platform Linear event ingestion failed for a Factory project',
      expect.objectContaining({ factoryProjectId: 'factory-1', eventId: '1000-0' }),
    );
    await worker.stop();
  });
});
