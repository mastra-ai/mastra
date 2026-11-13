import { describe, expect, it, vi } from 'vitest';
import { createBoardRegistry } from '../../boards/index.js';
import { createTestBoard } from '../../boards/test-utils.js';
import { createFactoryStorageForTests } from '../../storage/test-utils.js';
import { VantaRules } from './rules.js';
import { createVantaSync } from './sync.js';
import type { VantaVulnerability } from './sync.js';

const vulnerability: VantaVulnerability = {
  id: 'vuln-1',
  name: 'CVE-2026-1',
  description: 'Prototype pollution when merging untrusted objects.',
  packageIdentifier: 'lodash',
  severity: 'HIGH',
  isFixable: true,
  remediateByDate: '2026-12-01T00:00:00Z',
  firstDetectedDate: '2026-11-01T00:00:00Z',
  externalURL: 'https://app.vanta.com/vulnerabilities/vuln-1',
};

async function setup(options: { enabled: boolean; bound?: (projectId: string) => string[]; connected?: boolean }) {
  const seeded = await createFactoryStorageForTests();
  const project = await seeded.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'acme' } });
  const rules = new VantaRules({
    projects: seeded.projects,
    storage: seeded.workItems,
    configVersion: 'factory-config-v1',
    boards: createBoardRegistry({ boards: [createTestBoard()] }),
  });
  const listedProjects = { count: 0 };
  const sync = createVantaSync({
    connected: async () => options.connected ?? true,
    listVulnerabilities: async () => (options.connected === false ? [] : [vulnerability]),
    listProjects: async () => {
      listedProjects.count += 1;
      return [{ orgId: 'org-1', id: project.id }];
    },
    intakeEnabled: async () => options.enabled,
    boundProjectIds: async () => options.bound?.(project.id) ?? [],
    ingest: input => rules.ingest(input),
    userId: 'factory-rule-dispatcher',
  });
  return { project, sync, workItems: seeded.workItems, listedProjects };
}

describe('createVantaSync', () => {
  it('files each active vulnerability as a security-labeled card with its details', async () => {
    const { project, sync, workItems } = await setup({ enabled: true });

    const summary = await sync();

    expect(summary).toMatchObject({ projects: 1, checked: 1, failed: 0 });
    expect(await workItems.listDeferredDecisions('org-1', project.id)).toMatchObject([
      {
        decision: {
          type: 'upsertLinkedWorkItem',
          source: 'vanta-vulnerability',
          title: 'lodash: CVE-2026-1',
          description: expect.stringContaining('Prototype pollution when merging untrusted objects.'),
        },
      },
    ]);
  });

  it('files nothing for an org that has not enabled Vanta intake', async () => {
    const { project, sync, workItems } = await setup({ enabled: false });

    expect(await sync()).toMatchObject({ projects: 0, checked: 0 });
    expect(await workItems.listDeferredDecisions('org-1', project.id)).toEqual([]);
  });

  it('leaves filed vulnerabilities open and reads no projects while Vanta is not connected', async () => {
    const { project, sync, workItems, listedProjects } = await setup({ enabled: true, connected: false });
    await workItems.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
      input: {
        externalSource: { integrationId: 'vanta', type: 'vulnerability', externalId: vulnerability.id },
        title: 'lodash: CVE-2026-1',
        stages: ['intake'],
        sessions: {},
        metadata: { state: 'open' },
      },
    });

    expect(await sync()).toMatchObject({ projects: 0, checked: 0 });
    expect(listedProjects.count).toBe(0);
    expect(await workItems.listDeferredDecisions('org-1', project.id)).toEqual([]);
  });

  it('skips projects the vulnerabilities source is not bound to', async () => {
    const { project, sync, workItems } = await setup({ enabled: true, bound: () => ['other-project'] });

    expect(await sync()).toMatchObject({ projects: 0 });
    expect(await workItems.listDeferredDecisions('org-1', project.id)).toEqual([]);
  });

  it("runs a card added to another board under its own identity when the vulnerability was first seen without a card", async () => {
    const { project, sync, workItems } = await setup({ enabled: true });
    // The first sync sees the vulnerability before any card exists, and files one.
    await sync();
    const { item: filed } = await workItems.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
      input: {
        externalSource: { integrationId: 'vanta', type: 'vulnerability', externalId: vulnerability.id },
        title: 'lodash: CVE-2026-1',
        stages: ['intake'],
        sessions: {},
        metadata: { state: 'open' },
      },
    });
    const security = await workItems.linkWorkItemToBoard({
      orgId: 'org-1',
      id: filed.id,
      board: 'release',
      stage: 'queued',
      userId: 'user-1',
    });
    const commits = vi.spyOn(workItems, 'commitRuleEvaluation');

    await sync();
    await sync();

    const results = await Promise.all(commits.mock.results.map(result => result.value));
    const byCard = commits.mock.calls.map(([input], index) => [input.workItemId, input.ingress.identity, results[index].status]);
    expect(byCard).toEqual([
      // The first card keeps the identity the unbound evaluation was stored under.
      [filed.id, 'vanta:vuln-1:open', 'replayed'],
      [security!.id, `vanta:vuln-1:open:${security!.id}`, 'committed'],
      [filed.id, 'vanta:vuln-1:open', 'replayed'],
      [security!.id, `vanta:vuln-1:open:${security!.id}`, 'replayed'],
    ]);
  });
});
