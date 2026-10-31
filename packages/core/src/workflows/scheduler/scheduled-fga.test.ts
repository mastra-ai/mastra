import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import type { ActorSignal, FGACheckParams, IFGAProvider } from '../../auth/ee';
import { FGADeniedError } from '../../auth/ee/fga-check';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { createWorkflow } from '../create';
import { createStep } from '../workflow';
import type { WorkflowScheduleConfig } from './types';

// Scheduled fires carry no end user. With FGA configured, a parent workflow's
// nested child is authorized on its own, so it is denied unless the schedule
// opts in to a trusted actor (#28677).

const SCHEDULER_ACTOR = { actorKind: 'system', sourceWorkflow: 'scheduler' } as const;

const activeInstances: Mastra[] = [];
afterEach(async () => {
  const instances = activeInstances.splice(0, activeInstances.length);
  await Promise.all(instances.map(m => m.shutdown().catch(() => {})));
});

async function waitUntil(predicate: () => Promise<boolean>, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error(`waitUntil predicate did not become true within ${timeoutMs}ms`);
}

// Denies every user; allows system actors only when they come from the scheduler.
function createProvider() {
  const requireActor = vi.fn(async (actor: ActorSignal, params: FGACheckParams) => {
    if (actor === true || actor.sourceWorkflow !== 'scheduler') {
      throw new FGADeniedError(undefined, params.resource, params.permission, 'actor not allowed');
    }
  });
  const provider: IFGAProvider = {
    check: async () => false,
    require: async (user, { resource, permission }) => {
      throw new FGADeniedError(user, resource, permission);
    },
    filterAccessible: async () => [],
    requireActor,
  };
  return { provider, requireActor };
}

async function setup(schedule?: WorkflowScheduleConfig) {
  const { provider, requireActor } = createProvider();
  const childExecute = vi.fn(async () => ({ ok: true }));
  const child = createWorkflow({ id: 'child', inputSchema: z.any(), outputSchema: z.any() });
  child.then(createStep({ id: 'leaf', inputSchema: z.any(), outputSchema: z.any(), execute: childExecute })).commit();
  const parent = createWorkflow({
    id: 'nightly',
    inputSchema: z.any(),
    outputSchema: z.any(),
    ...(schedule ? { schedule } : {}),
  });
  parent.then(child).commit();

  const mastra = new Mastra({
    logger: false,
    storage: new MockStore(),
    workflows: { nightly: parent, child },
    server: { fga: provider },
    notifications: { dispatch: { enabled: false } },
    scheduler: { tickIntervalMs: 50 },
  });
  activeInstances.push(mastra);
  await mastra.startWorkers();

  const fire = async (scheduleId: string) => {
    const { claimId } = await mastra.schedules.run(scheduleId);
    await waitUntil(async () => {
      const run = await parent.getWorkflowRunById(claimId);
      return run?.status === 'success' || run?.status === 'failed';
    });
    return (await parent.getWorkflowRunById(claimId))!;
  };

  return { mastra, fire, childExecute, requireActor };
}

describe('scheduled workflows with FGA configured (#28677)', () => {
  it('runs a nested workflow when the schedule carries a trusted actor and tenant', async () => {
    const { mastra, fire, childExecute, requireActor } = await setup();

    const schedule = await mastra.schedules.create({
      workflowId: 'nightly',
      cron: '0 0 1 1 *',
      requestContext: { organizationId: 'org-1' },
      actor: SCHEDULER_ACTOR,
    });
    expect(schedule.actor).toEqual(SCHEDULER_ACTOR);

    const run = await fire(schedule.id);

    expect(run.status).toBe('success');
    expect(childExecute).toHaveBeenCalledTimes(1);
    expect(requireActor).toHaveBeenCalledWith(
      SCHEDULER_ACTOR,
      expect.objectContaining({ resource: { type: 'workflow', id: 'child' } }),
    );
  }, 10_000);

  it('still denies the nested workflow when the schedule has no actor', async () => {
    const { mastra, fire, childExecute, requireActor } = await setup();

    const schedule = await mastra.schedules.create({
      workflowId: 'nightly',
      cron: '0 0 1 1 *',
      requestContext: { organizationId: 'org-1' },
    });

    const run = await fire(schedule.id);

    expect(run.status).toBe('failed');
    expect(JSON.stringify(run.error)).toContain('authenticated user is required');
    expect(childExecute).not.toHaveBeenCalled();
    expect(requireActor).not.toHaveBeenCalled();
  }, 10_000);

  it('denies the nested workflow when the actor has no tenant scope', async () => {
    const { mastra, fire, childExecute, requireActor } = await setup();

    const schedule = await mastra.schedules.create({
      workflowId: 'nightly',
      cron: '0 0 1 1 *',
      actor: SCHEDULER_ACTOR,
    });

    const run = await fire(schedule.id);

    expect(run.status).toBe('failed');
    expect(JSON.stringify(run.error)).toContain('trusted actor requires organizationId');
    expect(childExecute).not.toHaveBeenCalled();
    expect(requireActor).not.toHaveBeenCalled();
  }, 10_000);

  it('lets the provider deny an actor it does not trust', async () => {
    const { mastra, fire, childExecute, requireActor } = await setup();

    const schedule = await mastra.schedules.create({
      workflowId: 'nightly',
      cron: '0 0 1 1 *',
      requestContext: { organizationId: 'org-1' },
      actor: { actorKind: 'system', sourceWorkflow: 'someone-else' },
    });

    const run = await fire(schedule.id);

    expect(run.status).toBe('failed');
    expect(childExecute).not.toHaveBeenCalled();
    expect(requireActor).toHaveBeenCalled();
  }, 10_000);

  it('passes a declarative schedule actor to the fired run', async () => {
    const { mastra, fire, childExecute, requireActor } = await setup({
      cron: '0 0 1 1 *',
      requestContext: { organizationId: 'org-1' },
      actor: SCHEDULER_ACTOR,
    });

    let scheduleId: string | undefined;
    await waitUntil(async () => {
      const schedules = await mastra.schedules.list();
      scheduleId = schedules.find(s => 'workflowId' in s && s.workflowId === 'nightly')?.id;
      return !!scheduleId;
    });
    const run = await fire(scheduleId!);

    expect(run.status).toBe('success');
    expect(childExecute).toHaveBeenCalledTimes(1);
    expect(requireActor).toHaveBeenCalledWith(SCHEDULER_ACTOR, expect.anything());
  }, 10_000);
});
