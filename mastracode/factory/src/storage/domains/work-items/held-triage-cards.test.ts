import { randomUUID } from 'node:crypto';

import { LibSQLFactoryStorage } from '@mastra/libsql';
import { PgFactoryStorage } from '@mastra/pg';
import { describe, expect, it, onTestFinished } from 'vitest';

import type { FactoryTriageType } from '../../../rules/types.js';
import { HELD_CARD_SWEEP_ACTOR, WorkItemsStorage } from './base.js';
import type { WorkItemRow } from './base.js';

const postgresUrl = process.env.FACTORY_TEST_POSTGRES_URL;
const PROJECT = 'project-held';

describe.each(['libsql', ...(postgresUrl ? ['postgres'] : [])])('returning held triage cards on %s', backend => {
  async function setup() {
    const storage =
      backend === 'postgres'
        ? new PgFactoryStorage({ id: `held-${randomUUID()}`, connectionString: postgresUrl! })
        : new LibSQLFactoryStorage({ id: `held-${randomUUID()}`, url: ':memory:' });
    const workItems = storage.registerDomain(new WorkItemsStorage());
    await storage.init();
    onTestFinished(() => storage.close());
    // The Postgres database is shared, so every test files its cards under its own org.
    const orgId = `org-${randomUUID()}`;
    let next = 0;

    async function file(board: string | undefined, bound: boolean): Promise<WorkItemRow> {
      next += 1;
      const input = {
        ...(board ? { board } : {}),
        externalSource: { integrationId: 'github', type: 'issue', externalId: `${orgId}-${next}` },
        title: `Card ${next}`,
        stages: ['intake'],
        sessions: {},
        metadata: {},
      };
      if (!bound) return (await workItems.upsert({ orgId, userId: 'user-1', factoryProjectId: PROJECT, input })).item;
      const started = await workItems.prepareRunStart({
        orgId,
        userId: 'user-1',
        factoryProjectId: PROJECT,
        workItem: { input },
        role: 'triage',
        session: { sessionId: `session-${orgId}-${next}`, branch: `factory/${next}`, threadId: `thread-${next}` },
        resourceId: 'resource-1',
        kickoffKey: `kickoff-${orgId}-${next}`,
        kickoffMessage: null,
      });
      return started.item;
    }

    /** How the old triage rule left a card: classified in Triage, accepted only when a person said so. */
    async function triaged(
      item: WorkItemRow,
      triageType: FactoryTriageType,
      { accept = false, arm = false }: { accept?: boolean; arm?: boolean } = {},
    ): Promise<WorkItemRow> {
      const committed = await workItems.commitTransition({
        orgId,
        factoryProjectId: PROJECT,
        workItemId: item.id,
        expectedRevision: item.revision,
        destinationStage: 'triage',
        actorId: 'agent:triage',
        ingress: { identity: `triage-${item.id}`, triggerType: 'agent', transitionId: `triage-${item.id}` },
        configVersion: 'held-cards',
        causalChain: [],
        evaluation: { outcome: 'accepted', decisions: [] },
        triageType,
        accept,
        ...(arm ? { autonomy: 'arm' as const } : {}),
      });
      if (committed.status !== 'committed' || !committed.item) throw new Error('seed transition failed');
      return committed.item;
    }

    /** A person starts a new run on the card after triage classified it. */
    async function startRun(item: WorkItemRow): Promise<WorkItemRow> {
      return (
        await workItems.prepareRunStart({
          orgId,
          userId: 'user-1',
          factoryProjectId: PROJECT,
          workItem: { id: item.id, input: { title: item.title } },
          role: 'triage',
          session: { sessionId: `rerun-${item.id}`, branch: 'factory/rerun', threadId: `rerun-${item.id}` },
          resourceId: 'resource-1',
          kickoffKey: `rerun-${item.id}`,
          kickoffMessage: null,
        })
      ).item;
    }

    const mine = (moved: WorkItemRow[]) => moved.filter(item => item.orgId === orgId).map(item => item.id);
    const stageOf = async (item: WorkItemRow) => (await workItems.get({ orgId, id: item.id }))?.stages;
    return { workItems, file, triaged, startRun, mine, stageOf, orgId };
  }

  it('moves only an unaccepted non-bug held in Triage with no newer run back to Intake, once', async () => {
    const { workItems, file, triaged, startRun, mine, stageOf, orgId } = await setup();
    // A person dragged it into Triage, which armed autonomy; back in Intake it waits for a person again.
    const held = await triaged(await file('work', false), 'feature request', { arm: true });
    const legacy = await triaged(await file(undefined, false), 'question/support');
    const bug = await triaged(await file('work', false), 'bug');
    const accepted = await triaged(await file('work', false), 'feature request', { accept: true });
    // The triage run that classified the card is still bound: bindings outlive their run.
    const classifying = await file('work', true);
    // The run classifies the card some time after it started.
    await new Promise(resolve => setTimeout(resolve, 5));
    const classifiedByItsRun = await triaged(classifying, 'docs');
    const rerun = await startRun(await triaged(await file('work', false), 'feature request'));
    const review = await triaged(await file('review', false), 'feature request');
    expect(held).toMatchObject({ triageType: 'feature request', acceptedAt: null, stages: ['triage'] });
    expect(held.autonomyArmedAt).not.toBeNull();
    expect(accepted.acceptedAt).not.toBeNull();

    const first = await workItems.returnHeldTriageCards();

    expect(mine(first).sort()).toEqual([held.id, legacy.id, classifiedByItsRun.id].sort());
    const after = await workItems.get({ orgId, id: held.id });
    expect(after).toMatchObject({ stages: ['intake'], revision: held.revision + 1, autonomyArmedAt: null });
    expect(after!.stageHistory.at(-1)).toMatchObject({ stage: 'intake', by: HELD_CARD_SWEEP_ACTOR });
    expect(await stageOf(legacy)).toEqual(['intake']);
    expect(await stageOf(classifiedByItsRun)).toEqual(['intake']);
    for (const untouched of [bug, accepted, rerun, review]) {
      expect(await stageOf(untouched)).toEqual(['triage']);
    }

    expect(mine(await workItems.returnHeldTriageCards())).toEqual([]);
    expect((await workItems.get({ orgId, id: held.id }))!.revision).toBe(held.revision + 1);
  });

  it('leaves a held card alone when it changes between the read and the move', async () => {
    const { workItems, file, triaged, mine, stageOf, orgId } = await setup();
    const held = await triaged(await file('work', false), 'feature request');
    // Two replicas booting at once: the slower one reads the card, then finds it already moved.
    const racing = Promise.all([workItems.returnHeldTriageCards(), workItems.returnHeldTriageCards()]);

    const [a, b] = await racing;

    expect([...mine(a), ...mine(b)]).toEqual([held.id]);
    expect(await stageOf(held)).toEqual(['intake']);
    expect((await workItems.get({ orgId, id: held.id }))!.revision).toBe(held.revision + 1);
  });
});
