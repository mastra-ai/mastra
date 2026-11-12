import { describe, expect, it } from 'vitest';
import { createBoardRegistry } from '../../boards/index.js';
import { createTestBoard } from '../../boards/test-utils.js';
import { createFactoryStorageForTests } from '../../storage/test-utils.js';
import { DependabotRules } from './rules.js';
import { createDependabotSync } from './sync.js';
import type { DependabotAlertLister, GithubDependabotAlert } from './sync.js';

const openAlert: GithubDependabotAlert = {
  number: 7,
  state: 'open',
  html_url: 'https://github.com/acme/repo/security/dependabot/7',
  created_at: '2026-11-01T10:00:00Z',
  updated_at: '2026-11-02T10:00:00Z',
  dependency: { package: { name: 'lodash', ecosystem: 'npm' }, manifest_path: 'package.json' },
  security_advisory: {
    ghsa_id: 'GHSA-xxxx',
    cve_id: 'CVE-2026-1',
    summary: 'Prototype pollution',
    description: 'Merging untrusted objects can modify Object.prototype.',
    severity: 'high',
  },
  security_vulnerability: { first_patched_version: { identifier: '4.17.21' } },
};

const target = { id: 101, fullName: 'acme/repo', installationId: 9 };

async function setup(listAlerts: DependabotAlertLister, enabledRepos = ['acme/repo', 'acme/locked']) {
  const seeded = await createFactoryStorageForTests();
  const project = await seeded.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'acme/repo' } });
  const rules = new DependabotRules({
    projects: seeded.projects,
    storage: seeded.workItems,
    configVersion: 'factory-config-v1',
    boards: createBoardRegistry({ boards: [createTestBoard()] }),
  });
  const sync = createDependabotSync({
    listAlerts,
    listProjects: async () => [{ orgId: 'org-1', factoryProjectId: project.id }],
    repositoryEnabled: async ({ repository }) => enabledRepos.includes(repository),
    ingest: input => rules.ingest(input),
    userId: 'factory-rule-dispatcher',
  });
  return { project, sync, workItems: seeded.workItems };
}

describe('createDependabotSync', () => {
  it('files an open alert as a security-labeled card the intake routes can match', async () => {
    const { project, sync, workItems } = await setup(async ({ state }) => (state === 'open' ? [openAlert] : []));

    const summary = await sync([target]);

    expect(summary).toMatchObject({ repositories: 1, alerts: 1, failed: 0 });
    expect(await workItems.listDeferredDecisions('org-1', project.id)).toMatchObject([
      {
        decision: {
          type: 'upsertLinkedWorkItem',
          source: 'github-dependabot-alert',
          title: 'lodash: Prototype pollution',
          description: expect.stringContaining('Merging untrusted objects can modify Object.prototype.'),
          url: openAlert.html_url,
          metadata: { labels: ['security', 'dependabot', 'severity:high'] },
        },
      },
    ]);
    const [{ decision }] = await workItems.listDeferredDecisions('org-1', project.id);
    expect(decision).toMatchObject({ description: expect.stringContaining('**Patched in:** `4.17.21`') });
  });

  it('never reads alerts for a repository the org has not opted in', async () => {
    const queried: string[] = [];
    const { project, sync, workItems } = await setup(async ({ repository }) => {
      queried.push(repository);
      return [openAlert];
    }, []);

    const summary = await sync([target]);

    expect(summary).toMatchObject({ repositories: 0, alerts: 0, failed: 0 });
    expect(queried).toEqual([]);
    expect(await workItems.listDeferredDecisions('org-1', project.id)).toEqual([]);
  });

  it('skips a repository whose alerts cannot be read and keeps sweeping the rest', async () => {
    const { sync } = await setup(async ({ repository, state }) => {
      if (repository === 'acme/locked') throw new Error('Dependabot alerts are disabled for this repository');
      return state === 'open' ? [openAlert] : [];
    });

    const summary = await sync([{ id: 202, fullName: 'acme/locked', installationId: 9 }, target]);

    expect(summary).toMatchObject({
      repositories: 1,
      alerts: 1,
      failed: 1,
      errors: [{ repository: 'acme/locked', error: 'Dependabot alerts are disabled for this repository' }],
    });
  });
});
