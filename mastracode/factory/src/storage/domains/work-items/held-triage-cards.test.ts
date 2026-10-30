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
      { accept = false }: { accept?: boolean } = {},
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
      });
      if (committed.status !== 'committed' || !committed.item) throw new Error('seed transition failed');
      return committed.item;
    }

    const mine = (moved: WorkItemRow[]) => moved.filter(item => item.orgId === orgId).map(item => item.id);
    const stageOf = async (item: WorkItemRow) => (await workItems.get({ orgId, id: item.id }))?.stages;
    return { workItems, file, triaged, mine, stageOf, orgId };
  }

  it('moves only an unaccepted non-bug held in Triage with no live run back to Intake, once', async () => {
    const { workItems, file, triaged, mine, stageOf, orgId } = await setup();
    const held = await triaged(await file('work', false), 'feature request');
    const legacy = await triaged(await file(undefined, false), 'question/support');
    const bug = await triaged(await file('work', false), 'bug');
    const accepted = await triaged(await file('work', false), 'feature request', { accept: true });
    const running = await triaged(await file('work', true), 'docs');
    const review = await triaged(await file('review', false), 'feature request');
    expect(held).toMatchObject({ triageType: 'feature request', acceptedAt: null, stages: ['triage'] });
    expect(accepted.acceptedAt).not.toBeNull();

    const first = await workItems.returnHeldTriageCards();

    expect(mine(first).sort()).toEqual([held.id, legacy.id].sort());
    const after = await workItems.get({ orgId, id: held.id });
    expect(after).toMatchObject({ stages: ['intake'], revision: held.revision + 1 });
    expect(after!.stageHistory.at(-1)).toMatchObject({ stage: 'intake', by: HELD_CARD_SWEEP_ACTOR });
    expect(await stageOf(legacy)).toEqual(['intake']);
    for (const untouched of [bug, accepted, running, review]) {
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
