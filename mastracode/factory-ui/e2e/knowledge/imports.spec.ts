import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const projectId = '00000000-0000-4000-8000-000000000501';
const scopeId = '00000000-0000-4000-8000-000000000502';
const output = process.env.KNOWLEDGE_PROOF_OUTPUT ? path.resolve(process.env.KNOWLEDGE_PROOF_OUTPUT) : undefined;

const queuedRun = {
  id: 'run-proof',
  importerId: 'github',
  binding: JSON.stringify(['repo:mastra', `resource:${projectId}`]),
  source: 'repo:mastra',
  scope: `resource:${projectId}`,
  importKind: 'agentic',
  triggerKind: 'programmatic',
  status: 'queued',
  queuedAt: '2026-08-30T09:00:00.000Z',
};

const completedRun = {
  ...queuedRun,
  status: 'succeeded',
  startedAt: '2026-08-30T09:00:01.000Z',
  completedAt: '2026-08-30T09:00:02.000Z',
  transcriptThreadId: 'knowledge-import-run:run-proof',
};

test('observes an agentic import from queue through transcript', async ({ context, page }) => {
  let completed = false;
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/auth/me')) {
      return route.fulfill({ json: { authenticated: true, authEnabled: true, user: { userId: 'proof-user' } } });
    }
    if (url.pathname.endsWith('/web/config/features')) return route.fulfill({ json: { knowledge: true } });
    if (url.pathname.endsWith('/web/factory/projects')) {
      return route.fulfill({ json: { projects: [{ id: projectId, name: 'Proof Factory' }] } });
    }
    if (url.pathname.endsWith(`/web/factory/projects/${projectId}`)) {
      return route.fulfill({ json: { id: projectId, name: 'Proof Factory' } });
    }
    if (url.pathname.endsWith('/source-control-connections')) return route.fulfill({ json: { connections: [] } });
    if (url.pathname.includes('/permissions')) return route.fulfill({ json: {} });
    if (url.pathname.endsWith('/work-items')) return route.fulfill({ json: { workItems: [] } });
    if (url.pathname.endsWith('/attention')) return route.fulfill({ json: { items: [] } });
    if (url.pathname.endsWith('/work-records')) return route.fulfill({ json: { workRecords: [] } });
    if (url.pathname.endsWith('/web/github/subscriptions')) return route.fulfill({ json: { subscriptions: [] } });
    if (url.pathname.endsWith('/knowledge/scopes')) {
      return route.fulfill({
        json: {
          scope: { id: scopeId, name: 'Proof Factory', kind: 'scope', parentScopeIds: [] },
          children: [],
        },
      });
    }
    if (url.pathname.endsWith('/knowledge/subgraph')) {
      return route.fulfill({
        json: {
          view: 'project',
          scopeId,
          nodes: [],
          edges: [],
          records: [],
          truncated: false,
          outOfWindow: [],
          unresolvedCapped: { count: 0, names: [] },
          pinCensus: { resource: 0, thread: null },
          version: null,
        },
      });
    }
    if (url.pathname.endsWith('/knowledge/activity')) return route.fulfill({ json: { events: [] } });
    if (url.pathname.endsWith('/knowledge/importers')) {
      return route.fulfill({
        json: {
          importers: [
            {
              id: 'github',
              importKind: 'agentic',
              triggers: ['programmatic'],
              bindings: [{ source: 'repo:mastra', scope: `resource:${projectId}` }],
              lastRun: completed ? completedRun : queuedRun,
            },
          ],
        },
      });
    }
    if (url.pathname.endsWith('/knowledge/importers/github/runs/run-proof')) {
      return route.fulfill({
        json: {
          run: completedRun,
          activity: [
            { id: 'activity-proof', action: 'create', targetType: 'record', createdAt: completedRun.completedAt },
          ],
          transcript: {
            threadId: completedRun.transcriptThreadId,
            available: true,
            messages: [
              {
                id: 'message-proof',
                role: 'assistant',
                content: 'Integrated the merged pull request into feature history.',
                createdAt: completedRun.completedAt,
              },
            ],
          },
        },
      });
    }
    if (url.pathname.endsWith('/knowledge/importers/github/runs')) {
      return route.fulfill({ json: { runs: [completed ? completedRun : queuedRun] } });
    }
    return route.continue();
  });

  await page.goto(`/factories/${projectId}/knowledge?view=imports`);
  await expect(page.getByText('queued')).toBeVisible();

  completed = true;
  await page.reload();
  await expect(page.getByText('succeeded')).toBeVisible();
  await page.getByLabel('Run status').click();
  await page.getByRole('option', { name: 'succeeded' }).click();
  await expect(page.getByText('repo:mastra')).toBeVisible();

  await page.getByText('repo:mastra').click();
  await expect(page.getByRole('heading', { name: 'Knowledge activity' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Agent transcript' })).toBeVisible();
  await expect(page.getByText('Integrated the merged pull request into feature history.')).toBeVisible();

  if (output) {
    fs.mkdirSync(output, { recursive: true });
    await page.screenshot({ path: path.join(output, 'imports-completed.png'), fullPage: true });
    await page.screenshot({ path: path.join(output, 'explore.png'), fullPage: true });
    fs.writeFileSync(
      path.join(output, 'results.json'),
      JSON.stringify(
        { tests: [{ title: 'observes an agentic import from queue through transcript', status: 'passed' }] },
        null,
        2,
      ),
    );
  }
});
