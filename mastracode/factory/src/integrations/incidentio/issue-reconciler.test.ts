import { describe, expect, it, vi } from 'vitest';

import { createFactoryStorageForTests } from '../../storage/test-utils.js';
import type { IntegrationContext } from '../base.js';
import { IncidentioIntegration } from './integration.js';
import { attachIncidentioIssueReconciler } from './issue-reconciler.js';

const incident = {
  id: 'incident-1',
  reference: 'INC-42',
  name: 'API unavailable',
  visibility: 'public',
  mode: 'standard',
  creator: { user: { id: 'user-1', name: 'Ada Lovelace' } },
  incident_status: { id: 'status-1', name: 'Learning', category: 'learning' },
  incident_type: { id: 'type-1', name: 'Production outage' },
  severity: { id: 'severity-1', name: 'Major', rank: 1 },
  created_at: '2026-09-01T10:00:00Z',
  updated_at: '2026-09-01T12:00:00Z',
};

const followUp = {
  id: 'follow-up-1',
  incident_id: 'incident-1',
  title: 'Add database failover alert',
  status: 'completed' as const,
  creator: { workflow: { id: 'workflow-1', name: 'Post-incident workflow' } },
  assignee: { id: 'user-2', name: 'Grace Hopper' },
  labels: ['reliability'],
  priority: { id: 'priority-1', name: 'Urgent', rank: 1 },
  created_at: '2026-09-02T10:00:00Z',
  updated_at: '2026-09-02T12:00:00Z',
};

function json(data: unknown): Response {
  return new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } });
}

describe('incident.io issue reconciler', () => {
  it('polls and refreshes imported incidents and follow-ups', async () => {
    const seeded = await createFactoryStorageForTests();
    const project = await seeded.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Factory' } });
    for (const externalId of ['incidentio:incident:incident-1', 'incidentio:follow-up:follow-up-1']) {
      await seeded.workItems.upsert({
        orgId: project.orgId,
        userId: project.createdBy,
        factoryProjectId: project.id,
        input: {
          externalSource: { integrationId: 'incidentio', type: 'issue', externalId, url: 'https://app.incident.io' },
          title: 'Stale title',
          stages: ['execute'],
          sessions: {},
          metadata: { stateType: 'unstarted', labels: ['stale'] },
        },
      });
    }

    const fetchImpl = vi.fn<typeof fetch>(async input => {
      const url = String(input);
      if (url.includes('/v2/incidents/incident-1')) return json({ incident });
      if (url.includes('/v3/follow_ups/follow-up-1')) return json({ follow_up: followUp });
      throw new Error(`Unexpected request: ${url}`);
    });
    const integration = new IncidentioIntegration({ apiKey: 'incident-key', fetchImpl });
    const context = {
      storage: { projects: seeded.projects },
      rules: { config: {}, workItems: seeded.workItems },
    } as unknown as IntegrationContext;
    const reconcile = attachIncidentioIssueReconciler(integration, context);

    await expect(reconcile?.()).resolves.toMatchObject({
      projects: 1,
      checked: 2,
      updated: 2,
      failed: 0,
    });
    const items = await seeded.workItems.list({ orgId: project.orgId, factoryProjectId: project.id });
    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          externalSource: expect.objectContaining({ externalId: 'incidentio:incident:incident-1' }),
          metadata: expect.objectContaining({
            incidentioItemType: 'incident',
            incidentioState: 'Learning',
            incidentioStateType: 'started',
            priority: 'Major',
            author: 'Ada Lovelace',
            labels: ['Major', 'Production outage', 'standard'],
          }),
        }),
        expect.objectContaining({
          externalSource: expect.objectContaining({ externalId: 'incidentio:follow-up:follow-up-1' }),
          metadata: expect.objectContaining({
            incidentioItemType: 'follow-up',
            incidentioState: 'completed',
            incidentioStateType: 'completed',
            assignee: 'Grace Hopper',
            labels: ['reliability'],
          }),
        }),
      ]),
    );
  });
});
