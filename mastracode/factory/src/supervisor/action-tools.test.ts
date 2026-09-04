import { describe, expect, it, vi } from 'vitest';

import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { createFactorySupervisorActionTools } from './action-tools.js';

const PROJECT_ID = '11111111-2222-4333-8444-555555555555';
const SCOPE = { orgId: 'org-1', factoryProjectId: PROJECT_ID };
const NOW = new Date('2026-09-04T12:00:00.000Z');

function execute<T>(tool: unknown, input: unknown): Promise<T> {
  return (tool as { execute: (input: unknown, ctx: unknown) => Promise<T> }).execute(input, {});
}

const finding = (key: string) => ({
  kind: 'decision-failed' as const,
  id: key,
  workItemId: null,
  workItemNumber: null,
  title: 'Issue 1',
  evidence: '[run_awaiting_input] failed after 1 attempt(s)',
  ageMs: 1_000,
  suggestedRepair: null,
});

async function setup(actor: { type: 'human' | 'agent'; id: string } = { type: 'agent', id: 'agent:thread-1' }) {
  const seed = await createFactoryStorageForTests();
  await seed.workItems.syncSupervisorFindings({ ...SCOPE, findings: [finding('decision-failed:d1')], now: NOW });
  const tools = createFactorySupervisorActionTools({
    scope: SCOPE,
    actor,
    workItems: seed.workItems,
    audit: seed.audit,
    now: () => NOW,
  });
  return { ...seed, tools };
}

async function openRow(workItems: Awaited<ReturnType<typeof setup>>['workItems'], key: string) {
  return (await workItems.listSupervisorFindingPage({ ...SCOPE, limit: 10 })).rows.find(row => row.findingKey === key);
}

describe('factory_escalate_finding', () => {
  it('is approval-free: escalating is how the supervisor reaches a person', async () => {
    const { tools } = await setup();
    expect((tools.factory_escalate_finding as { requireApproval?: boolean }).requireApproval).toBeFalsy();
  });

  it('escalates an open finding with the note and audits the actor the turn has', async () => {
    const { tools, workItems, audit } = await setup();

    const result = await execute<any>(tools.factory_escalate_finding, {
      findingKey: 'decision-failed:d1',
      note: 'Worker is asking which API version to target.',
    });

    expect(result).toEqual({
      findingKey: 'decision-failed:d1',
      status: 'escalated',
      escalatedAt: NOW.toISOString(),
      note: 'Worker is asking which API version to target.',
      audited: true,
    });
    const row = await openRow(workItems, 'decision-failed:d1');
    expect(row).toMatchObject({ status: 'escalated', escalationNote: 'Worker is asking which API version to target.' });
    expect(row?.escalatedAt?.getTime()).toBe(NOW.getTime());
    const event = (await audit.list({ orgId: 'org-1', factoryProjectId: PROJECT_ID, limit: 5 })).events[0];
    expect(event).toMatchObject({
      action: 'factory.supervisor.finding_escalated',
      actorType: 'agent',
      actorId: 'agent:thread-1',
      targets: [{ type: 'supervisor_finding', id: 'decision-failed:d1' }],
      metadata: { cause: 'supervisor', note: 'Worker is asking which API version to target.' },
    });
  });

  it('reports an escalation that landed even when the audit write fails', async () => {
    const seed = await createFactoryStorageForTests();
    await seed.workItems.syncSupervisorFindings({ ...SCOPE, findings: [finding('decision-failed:d1')], now: NOW });
    const warn = vi.fn();
    const tools = createFactorySupervisorActionTools({
      scope: SCOPE,
      actor: { type: 'agent', id: 'agent:thread-1' },
      workItems: seed.workItems,
      audit: {
        record: async () => {
          throw new Error('audit store down at postgres://secret');
        },
      },
      logger: { warn },
      now: () => NOW,
    });

    const result = await execute<any>(tools.factory_escalate_finding, { findingKey: 'decision-failed:d1', note: 'n' });

    // The row is escalated (the human-visible effect) and the result says the
    // audit did not land, so the supervisor neither retries nor believes it
    // failed. The raw storage error goes to the log, not the model.
    expect(result).toMatchObject({ status: 'escalated', audited: false, auditError: expect.any(String) });
    expect(result.auditError).not.toContain('postgres');
    expect(warn).toHaveBeenCalledWith(
      'Factory supervisor escalation audit failed',
      expect.objectContaining({ error: expect.stringContaining('postgres://secret') }),
    );
    expect(await openRow(seed.workItems, 'decision-failed:d1')).toMatchObject({ status: 'escalated' });
  });

  it('attributes to the human on an authenticated turn', async () => {
    const { tools, audit } = await setup({ type: 'human', id: 'user-7' });
    await execute(tools.factory_escalate_finding, { findingKey: 'decision-failed:d1', note: 'n' });
    const event = (await audit.list({ orgId: 'org-1', factoryProjectId: PROJECT_ID, limit: 5 })).events[0];
    expect(event).toMatchObject({ actorType: 'human', actorId: 'user-7' });
  });

  it('rejects unknown and resolved findings without writing an audit row', async () => {
    const { tools, workItems, audit } = await setup();
    await expect(
      execute(tools.factory_escalate_finding, { findingKey: 'decision-failed:nope', note: 'n' }),
    ).rejects.toThrow(/not open/);
    await workItems.syncSupervisorFindings({ ...SCOPE, findings: [], now: NOW });
    await expect(
      execute(tools.factory_escalate_finding, { findingKey: 'decision-failed:d1', note: 'n' }),
    ).rejects.toThrow(/not open/);
    expect((await audit.list({ orgId: 'org-1', factoryProjectId: PROJECT_ID, limit: 5 })).events).toEqual([]);
  });

  it('is scoped to its own factory project', async () => {
    const seed = await createFactoryStorageForTests();
    const otherProject = '99999999-2222-4333-8444-555555555555';
    await seed.workItems.syncSupervisorFindings({
      orgId: 'org-1',
      factoryProjectId: otherProject,
      findings: [finding('decision-failed:elsewhere')],
      now: NOW,
    });
    const tools = createFactorySupervisorActionTools({
      scope: SCOPE,
      actor: { type: 'agent', id: 'agent:thread-1' },
      workItems: seed.workItems,
      audit: seed.audit,
      now: () => NOW,
    });
    await expect(
      execute(tools.factory_escalate_finding, { findingKey: 'decision-failed:elsewhere', note: 'n' }),
    ).rejects.toThrow(/not open/);
    const untouched = (
      await seed.workItems.listSupervisorFindingPage({ orgId: 'org-1', factoryProjectId: otherProject, limit: 5 })
    ).rows[0];
    expect(untouched?.status).toBe('open');
  });

  it('rejects an empty note', async () => {
    const { tools } = await setup();
    await expect(
      execute<{ error?: boolean }>(tools.factory_escalate_finding, { findingKey: 'decision-failed:d1', note: '  ' }),
    ).resolves.toMatchObject({ error: true });
  });
});
