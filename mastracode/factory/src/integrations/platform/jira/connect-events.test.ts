import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBoardRegistry } from '../../../boards/index.js';
import { createFactoryStorageForTests } from '../../../storage/test-utils.js';
import type { IntegrationContext } from '../../base.js';
import type { PlatformConnectEventDelivery } from '../foundation/events-worker.js';
import { jiraIssueFromPayload } from './connect-events.js';
import { encodeIssueReference, PlatformJiraIntegration } from './integration.js';

const PLATFORM_BASE = 'https://integrations.example.com';
const CLOUD_ID = 'a436116f-02ce-4520-8fbb-7301462a1674';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

/** Jira's live view of ENG-42: still to do. */
const liveIssue = {
  id: '10042',
  key: 'ENG-42',
  fields: {
    summary: 'Issue ENG-42',
    status: { name: 'To Do', statusCategory: { key: 'new' } },
    assignee: { displayName: 'Ada' },
    reporter: { displayName: 'Grace' },
    labels: ['bug'],
    priority: { name: 'High' },
    project: { id: '1', key: 'ENG' },
    created: '2026-07-01T00:00:00Z',
    updated: '2026-07-02T00:00:00Z',
  },
};

/** A webhook body that claims ENG-42 is done; only its issue key and id may be read. */
function webhook(key = 'ENG-42', id = '10042') {
  return {
    webhookEvent: 'jira:issue_updated',
    issue: { id, key, fields: { status: { name: 'Done', statusCategory: { key: 'done' } }, labels: ['forged'] } },
  };
}

function delivery(
  payload: unknown,
  overrides: Partial<PlatformConnectEventDelivery> = {},
): PlatformConnectEventDelivery {
  return {
    id: '7001',
    timestamp: 1_700_000_000_000,
    connectionId: 'a1b_acme',
    integrationId: 'jira',
    eventType: 'jira:issue_updated',
    sourceEventId: null,
    payload,
    unverified: false,
    dedupeKey: '7001',
    ...overrides,
  };
}

async function setup(options: { issueId?: string; issueResponse?: () => Response } = {}) {
  const seeded = await createFactoryStorageForTests();
  const project = await seeded.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Factory' } });
  await seeded.workItems.upsert({
    orgId: project.orgId,
    userId: project.createdBy,
    factoryProjectId: project.id,
    input: {
      externalSource: {
        integrationId: 'jira',
        type: 'issue',
        externalId: encodeIssueReference({
          connectionId: 'a1b_acme',
          issueId: options.issueId ?? 'ENG-42',
          projectId: '1',
        }),
        url: 'https://acme.atlassian.net/browse/ENG-42',
      },
      title: 'Stale Jira issue',
      stages: ['planning'],
      sessions: {},
      metadata: { stateType: 'started', labels: ['stale'] },
    },
  });
  const issueRequests: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async input => {
      const target = String(input);
      if (target.endsWith('/v2/projects/proj_factory/connections')) {
        return json({
          connections: [
            { id: 'a1b_acme', integrationId: 'jira', status: 'active', accountLabel: 'acme.atlassian.net' },
            { id: 'a1b_beta', integrationId: 'jira', status: 'active', accountLabel: 'beta.atlassian.net' },
          ],
        });
      }
      if (/\/v2\/connections\/[^/]+\/context$/.test(target)) {
        return json({ connection_config: { cloudId: CLOUD_ID }, metadata: null });
      }
      if (target.includes(`/proxy/ex/jira/${CLOUD_ID}/rest/api/3/issue/`)) {
        issueRequests.push(target);
        if (target.includes('/comment')) return json({ comments: [], startAt: 0, maxResults: 50, total: 0 });
        return options.issueResponse?.() ?? json(liveIssue);
      }
      throw new Error(`Unexpected request: ${target}`);
    }),
  );
  const jira = new PlatformJiraIntegration({
    connect: { baseUrl: PLATFORM_BASE, projectId: 'proj_factory', accessToken: 'platform-token' },
  });
  const context = {
    storage: { projects: seeded.projects },
    runtime: { configVersion: 'test-v1', workItems: seeded.workItems, boards: createBoardRegistry() },
  } as unknown as IntegrationContext;
  const route = jira.connectEventRoute(context)!;
  const card = async () => (await seeded.workItems.list({ orgId: project.orgId, factoryProjectId: project.id }))[0]!;
  return { route, card, issueRequests };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PlatformJiraIntegration events', () => {
  it("updates a tracked issue's card from Jira, not from the event's payload", async () => {
    const { route, card, issueRequests } = await setup();

    await route.handle(delivery(webhook()));

    expect(issueRequests.some(url => url.includes('/rest/api/3/issue/ENG-42?'))).toBe(true);
    expect((await card()).workItem.metadata).toMatchObject({
      identifier: 'ENG-42',
      state: 'To Do',
      stateType: 'unstarted',
      labels: ['bug'],
    });
  });

  it('treats an unverified event only as a reason to re-fetch the issue', async () => {
    const { route, card } = await setup();

    await route.handle(delivery(webhook(), { unverified: true }));

    expect((await card()).workItem.metadata).toMatchObject({ state: 'To Do', stateType: 'unstarted', labels: ['bug'] });
  });

  it('matches a card stored by issue id as well as by key', async () => {
    const { route, card } = await setup({ issueId: '10042' });

    await route.handle(delivery(webhook()));

    expect((await card()).workItem.metadata).toMatchObject({ state: 'To Do', stateType: 'unstarted' });
  });

  it('does nothing for an issue no card tracks, or the same key on another Jira site', async () => {
    const { route, card, issueRequests } = await setup();
    const before = await card();

    await route.handle(delivery(webhook('ENG-99', '10099')));
    await route.handle(delivery(webhook(), { connectionId: 'a1b_beta' }));
    await route.handle(delivery({ webhookEvent: 'jira:worklog_updated', worklog: { issueId: '10042' } }));

    expect(issueRequests).toEqual([]);
    expect((await card()).workItem.metadata).toEqual(before.workItem.metadata);
  });

  it('fails the delivery when Jira cannot be read, so the events worker retries it', async () => {
    const { route, card } = await setup({ issueResponse: () => json({ errorMessages: ['down'] }, 503) });
    const before = await card();

    await expect(route.handle(delivery(webhook()))).rejects.toThrow('Jira issue ENG-42 could not be reconciled');
    expect((await card()).workItem.metadata).toEqual(before.workItem.metadata);
  });
});

describe('jiraIssueFromPayload', () => {
  it('reads the issue key and id from issue and comment webhooks', () => {
    expect(jiraIssueFromPayload(webhook())).toEqual(['ENG-42', '10042']);
    expect(
      jiraIssueFromPayload({
        webhookEvent: 'comment_created',
        comment: { id: '1' },
        issue: { id: 10042, key: 'ENG-42' },
      }),
    ).toEqual(['ENG-42', '10042']);
    expect(jiraIssueFromPayload({ issue: null })).toEqual([]);
    expect(jiraIssueFromPayload('not json')).toEqual([]);
  });
});
