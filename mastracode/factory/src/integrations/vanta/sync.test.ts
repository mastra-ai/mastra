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

async function setup(options: { enabled: boolean; bound?: (projectId: string) => string[] }) {
  const seeded = await createFactoryStorageForTests();
  const project = await seeded.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'acme' } });
  const rules = new VantaRules({
    projects: seeded.projects,
    storage: seeded.workItems,
    configVersion: 'factory-config-v1',
    boards: createBoardRegistry({ boards: [createTestBoard()] }),
  });
  const sync = createVantaSync({
    listVulnerabilities: async () => [vulnerability],
    listProjects: async () => [{ orgId: 'org-1', id: project.id }],
    intakeEnabled: async () => options.enabled,
    boundProjectIds: async () => options.bound?.(project.id) ?? [],
    ingest: input => rules.ingest(input),
    userId: 'factory-rule-dispatcher',
  });
  return { project, sync, workItems: seeded.workItems };
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

  it('skips projects the vulnerabilities source is not bound to', async () => {
    const { project, sync, workItems } = await setup({ enabled: true, bound: () => ['other-project'] });

    expect(await sync()).toMatchObject({ projects: 0 });
    expect(await workItems.listDeferredDecisions('org-1', project.id)).toEqual([]);
  });

  it('does not reconcile an unavailable snapshot or retry it for another project in the same org', async () => {
    const ingest = vi.fn();
    const listVulnerabilities = vi.fn(async () => null);
    const sync = createVantaSync({
      listVulnerabilities,
      listProjects: async () => [{ orgId: 'org-1', id: 'project-1' }, { orgId: 'org-1', id: 'project-2' }],
      intakeEnabled: async () => true,
      boundProjectIds: async () => [],
      ingest,
      userId: 'factory-rule-dispatcher',
    });
    expect(await sync()).toMatchObject({ projects: 0, checked: 0 });
    expect(listVulnerabilities).toHaveBeenCalledTimes(1);
    expect(ingest).not.toHaveBeenCalled();
  });

  it('passes only the owning organization snapshot to each project', async () => {
    const ingest = vi.fn();
    const sync = createVantaSync({
      listVulnerabilities: async orgId => orgId === 'org-1' ? [vulnerability] : [{ ...vulnerability, id: 'vuln-2' }],
      listProjects: async () => [{ orgId: 'org-1', id: 'project-1' }, { orgId: 'org-2', id: 'project-2' }],
      intakeEnabled: async () => true,
      boundProjectIds: async () => [],
      ingest,
      userId: 'factory-rule-dispatcher',
    });
    expect(await sync()).toMatchObject({ projects: 2, checked: 2 });
    expect(ingest.mock.calls[0]?.[0]).toMatchObject({ orgId: 'org-1', vulnerabilities: [{ id: 'vuln-1' }] });
    expect(ingest.mock.calls[1]?.[0]).toMatchObject({ orgId: 'org-2', vulnerabilities: [{ id: 'vuln-2' }] });
  });
});
