import { expect, it, vi } from 'vitest';
const fake = vi.hoisted(() => ({
  title: '',
  stateId: '',
  create: vi.fn(),
  update: vi.fn(),
  states: vi.fn(),
  labels: vi.fn(),
}));
vi.mock('@linear/sdk', () => ({
  LinearClient: class {
    organization = Promise.resolve({ id: 'workspace' });
    team = async () => ({
      id: 'team',
      organization: Promise.resolve({ id: 'workspace' }),
      states: fake.states,
    });
    issueLabels = fake.labels;
    searchIssues = async () => ({ nodes: [] });
    createIssue = async (payload: { title: string; stateId: string }) => {
      fake.create(payload);
      fake.title = payload.title;
      fake.stateId = payload.stateId;
      return { success: true, issue: Promise.resolve({ id: 'issue_1' }) };
    };
    updateIssue = async (_id: string, payload: { title: string; stateId: string }) => {
      fake.update(payload);
      fake.title = payload.title;
      fake.stateId = payload.stateId;
      return { success: true, issue: Promise.resolve({ id: 'issue_1' }) };
    };
    issue = async () => ({
      id: 'issue_1',
      title: fake.title,
      state: Promise.resolve({ id: fake.stateId }),
      team: Promise.resolve({ id: 'team' }),
    });
  },
}));
import { createLinearIncidentProvider } from '../../src/providers/linear-incident-provider.js';

it('discovers paginated names, creates in review and verifies completion without ID maps', async () => {
  fake.states.mockImplementation(async ({ after }: { after?: string }) =>
    after
      ? {
          nodes: [
            { id: 'done', name: 'Concluído', type: 'completed', position: 3 },
            {
              id: 'canceled',
              name: 'Cancelado',
              type: 'canceled',
              position: 4,
            },
          ],
          pageInfo: { hasNextPage: false },
        }
      : {
          nodes: [
            { id: 'backlog', name: 'Backlog', type: 'backlog', position: 0 },
            { id: 'review', name: 'Revisão', type: 'started', position: 1 },
          ],
          pageInfo: { hasNextPage: true, endCursor: 'states-page-2' },
        },
  );
  fake.labels.mockImplementation(async ({ after }: { after?: string }) =>
    after
      ? {
          nodes: [{ id: 'high', name: 'Alta', team: Promise.resolve({ id: 'team' }) }],
          pageInfo: { hasNextPage: false },
        }
      : {
          nodes: [
            {
              id: 'other',
              name: 'Alta',
              team: Promise.resolve({ id: 'other-team' }),
            },
          ],
          pageInfo: { hasNextPage: true, endCursor: 'labels-page-2' },
        },
  );
  const provider = createLinearIncidentProvider({
    apiKey: 'fake',
    workspaceId: 'workspace',
    teamId: 'team',
    severityLabelIds: {},
    statusStateIds: {},
    internalBaseUrl: 'https://security.example.test/dashboard',
    severityLabelNames: { high: 'Alta' },
    statusStateNames: { awaiting_approval: 'Revisão', contained: 'Concluído' },
  });
  const projection = {
    incidentId: 'incident_1',
    tenantId: 'tenant_1',
    kind: 'unknown_device_login' as const,
    severity: 'high' as const,
    status: 'awaiting_approval' as const,
    occurredAt: '2026-09-06T00:00:00.000Z',
    summaryCode: 'UNKNOWN_DEVICE_REQUIRES_REVIEW' as const,
    planHashVersion: 1 as const,
    planHash: 'a'.repeat(64),
    actionTypes: ['revoke_session' as const],
  };
  await expect(provider.create({ projection, idempotencyKey: 'create_1', generation: 1 })).resolves.toEqual({
    externalRef: 'linear:issue_1',
  });
  expect(fake.create).toHaveBeenCalledWith(
    expect.objectContaining({
      stateId: 'review',
      labelIds: ['high'],
      priority: 2,
    }),
  );
  await expect(
    provider.update({
      projection: {
        ...projection,
        status: 'contained',
        summaryCode: 'CONTAINMENT_SUCCEEDED',
      },
      externalRef: 'linear:issue_1',
      idempotencyKey: 'update_1',
      generation: 2,
    }),
  ).resolves.toEqual({ externalRef: 'linear:issue_1' });
  expect(fake.update).toHaveBeenCalledWith(expect.objectContaining({ stateId: 'done' }));
  expect(fake.states).toHaveBeenCalledTimes(2);
  expect(fake.labels).toHaveBeenCalledTimes(2);
});
