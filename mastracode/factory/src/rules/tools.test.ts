import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';

import type { BoardTransitionPolicy } from '../boards/index.js';
import { boardRegistryOf, defineBoard, workBoard } from '../boards/index.js';
import { createPolicyTestRegistry, selfReviewWorkBoard, createTriageWorkRegistry } from '../boards/test-utils.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { createFactoryOutcomeTools } from './tools.js';

const PROJECT_ID = '11111111-2222-4333-8444-555555555555';

type ExecutableTool = {
  execute: (input: unknown, context: unknown) => Promise<unknown>;
  inputSchema: { safeParse: (input: unknown) => { success: boolean } };
  requireApproval: boolean;
};

function requestContext(
  overrides: Partial<{ orgId: string; projectId: string; threadId: string; resourceId: string }> = {},
) {
  const context = new RequestContext();
  context.set('user', { workosId: 'user-1', organizationId: overrides.orgId ?? 'org-1' });
  context.set('controller', {
    resourceId: overrides.resourceId ?? 'resource-1',
    threadId: overrides.threadId ?? 'thread-1',
    sessionId: overrides.resourceId ?? 'resource-1',
    session: { id: 'session-1', ownerId: 'code', modeId: 'build' },
    getState: () => ({ factoryProjectId: overrides.projectId ?? PROJECT_ID }),
  });
  return context;
}

/** A session recreated after a server crash: coordinates intact, state empty. */
function crashResumedContext(
  setState: (updates: Record<string, unknown>) => Promise<void>,
  overrides: Partial<{ threadId: string; resourceId: string }> = {},
) {
  const context = new RequestContext();
  context.set('user', { workosId: 'user-1', organizationId: 'org-1' });
  context.set('controller', {
    resourceId: overrides.resourceId ?? 'resource-1',
    threadId: overrides.threadId ?? 'thread-1',
    sessionId: overrides.resourceId ?? 'resource-1',
    session: { id: 'session-1', ownerId: 'code', modeId: 'build' },
    getState: () => ({}),
    setState,
  });
  return context;
}

async function prepareBoundItem(
  storage: WorkItemsStorage,
  source: 'github-issue' | 'github-pr' | 'gitlab-pr' = 'github-issue',
  role: 'triage' | 'work' | 'plan' | 'review' = source.endsWith('-pr') ? 'review' : 'work',
) {
  return storage.prepareRunStart({
    orgId: 'org-1',
    userId: 'user-1',
    factoryProjectId: PROJECT_ID,
    workItem: {
      input: {
        externalSource: {
          integrationId: source.startsWith('gitlab-') ? 'gitlab' : 'github',
          type: source.endsWith('-pr') ? 'pull-request' : 'issue',
          externalId: `${source}:1`,
        },
        title: 'Factory item',
        stages: ['intake'],
        sessions: {},
        metadata: { authorTrusted: true },
      },
    },
    role,
    session: { sessionId: 'resource-1', branch: 'factory/item', threadId: 'thread-1' },
    resourceId: 'resource-1',
    kickoffKey: 'kickoff-1',
    kickoffMessage: null,
  });
}

async function execute(tool: ExecutableTool, context: RequestContext, input: unknown, toolCallId = 'tool-call-1') {
  return tool.execute(input, { requestContext: context, agent: { toolCallId } });
}

/** Puts the card in `stage`, the way a move the engine accepted leaves it. */
async function inPhase(storage: WorkItemsStorage, id: string, stage: string, board?: string) {
  await storage.update({
    orgId: 'org-1',
    id,
    userId: 'user-1',
    patch: { stages: [stage], ...(board ? { board } : {}) },
  });
}

describe('factory_report_outcome', () => {
  it('records one of the outcomes of the phase the card is in, and moves nothing', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const prepared = await prepareBoundItem(storage);
    await inPhase(storage, prepared.item.id, 'planning');
    const context = requestContext();
    const tool = (await createFactoryOutcomeTools({ requestContext: context, storage }))
      .factory_report_outcome as ExecutableTool & { description: string };
    expect(tool.description).toContain('factory-phase signal');
    expect(tool.description).toContain('you never move the card yourself');

    await expect(
      execute(tool, context, { outcome: 'advance', reason: 'The plan is approved.' }, 'report-1'),
    ).resolves.toEqual({
      status: 'reported',
      outcome: 'advance',
      label: 'Plan approved',
      to: 'Building',
      note: 'Factory moves the card once this run ends. Finish your reply, then stop.',
    });
    const reported = (await storage.get({ orgId: 'org-1', id: prepared.item.id }))!;
    expect(reported.stages).toEqual(['planning']);
    expect(reported.metadata?.phaseOutcome).toEqual({
      phase: 'planning',
      outcome: 'advance',
      to: 'execute',
      reason: 'The plan is approved.',
      source: 'reported',
      at: expect.any(String),
      bindingId: prepared.binding.id,
    });

    // Reporting again before the run ends changes the outcome.
    await execute(tool, context, { outcome: 'rest', reason: 'Needs a maintainer.' }, 'report-2');
    expect((await storage.get({ orgId: 'org-1', id: prepared.item.id }))!.metadata?.phaseOutcome).toMatchObject({
      outcome: 'rest',
      to: 'intake',
    });

    await expect(execute(tool, context, { outcome: 'ship', reason: 'Ship it.' }, 'report-3')).rejects.toThrow(
      'Planning has no outcome "ship"; report one of: advance, rest, done, cancel.',
    );
  });

  it('offers one outcome per next phase on a board that declares none, and follows live role rotations', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const board = defineBoard({
      id: 'release',
      name: 'Release',
      initialPhase: 'queued',
      phases: {
        queued: { name: 'Queued', kind: 'resting', nextPhases: ['preparing'] },
        preparing: {
          name: 'Preparing',
          kind: 'working',
          runner: { context: 'triage' },
          nextPhases: ['shipping', 'queued'],
        },
        shipping: {
          name: 'Shipping',
          kind: 'working',
          runner: { context: 'release-publisher' },
          nextPhases: ['shipped'],
        },
        shipped: { name: 'Shipped', kind: 'terminal' },
      },
    });
    const boards = boardRegistryOf([board]);
    const prepared = await storage.prepareRunStart({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: PROJECT_ID,
      workItem: {
        input: {
          board: 'release',
          title: 'Release',
          stages: ['preparing'],
          externalSource: { integrationId: 'github', type: 'issue', externalId: 'release:1' },
          metadata: { authorTrusted: true },
        },
      },
      role: 'triage',
      session: { sessionId: 'resource-1', branch: 'release', threadId: 'thread-1' },
      resourceId: 'resource-1',
      kickoffKey: 'release-1',
      kickoffMessage: null,
    });
    const context = requestContext();
    const tool = (await createFactoryOutcomeTools({ requestContext: context, storage, boards }))
      .factory_report_outcome as ExecutableTool;

    await expect(execute(tool, context, { outcome: 'shipped', reason: 'Skip.' }, 'skip')).rejects.toThrow(
      'Preparing has no outcome "shipped"; report one of: shipping, queued.',
    );
    await expect(execute(tool, context, { outcome: 'shipping', reason: 'Ready.' }, 'ready')).resolves.toMatchObject({
      outcome: 'shipping',
      label: 'Shipping',
      to: 'Shipping',
    });

    // The card moved on and the publisher took its turn in the same session: the same tool reports for it.
    await inPhase(storage, prepared.item.id, 'shipping');
    const rotated = await storage.prepareRunStart({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: PROJECT_ID,
      workItem: { id: prepared.item.id, input: { title: 'Release', board: 'release', stages: ['shipping'] } },
      role: 'release-publisher',
      session: { sessionId: 'resource-1', branch: 'release', threadId: 'thread-1' },
      resourceId: 'resource-1',
      kickoffKey: 'release-2',
      kickoffMessage: null,
    });
    expect(rotated.binding.id).not.toBe(prepared.binding.id);
    await execute(tool, context, { outcome: 'shipped', reason: 'Published.' }, 'published');
    expect((await storage.get({ orgId: 'org-1', id: prepared.item.id }))!.metadata?.phaseOutcome).toMatchObject({
      phase: 'shipping',
      outcome: 'shipped',
      bindingId: rotated.binding.id,
    });
  });

  it('refuses a report from a session that does not work the card in its current phase', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const prepared = await prepareBoundItem(storage);
    const context = requestContext();
    const tool = (await createFactoryOutcomeTools({ requestContext: context, storage }))
      .factory_report_outcome as ExecutableTool;

    // Intake rests: a person moves the card on from there.
    await expect(execute(tool, context, { outcome: 'planning', reason: 'Ready.' })).rejects.toThrow(
      'This session does not work the card in its current phase (intake), so it has no outcome to report.',
    );
    // Review is worked by the review context, not by this builder.
    await inPhase(storage, prepared.item.id, 'pr-review');
    await expect(execute(tool, context, { outcome: 'done', reason: 'Merged.' })).rejects.toThrow(
      'does not work the card in its current phase (pr-review)',
    );
    expect((await storage.get({ orgId: 'org-1', id: prepared.item.id }))!.metadata).not.toHaveProperty('phaseOutcome');
  });

  it('records the outcome on the card as it is now when another write lands first', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const prepared = await prepareBoundItem(storage);
    await inPhase(storage, prepared.item.id, 'execute');
    const context = requestContext();
    const tool = (await createFactoryOutcomeTools({ requestContext: context, storage }))
      .factory_report_outcome as ExecutableTool;
    const update = storage.update.bind(storage);
    let raced = false;
    vi.spyOn(storage, 'update').mockImplementation(async args => {
      if (!raced && args.patch.metadata && 'phaseOutcome' in args.patch.metadata) {
        raced = true;
        await update({
          orgId: 'org-1',
          id: prepared.item.id,
          userId: 'webhook',
          patch: { metadata: { lastWebhookAt: '2026-11-24T10:00:00.000Z' } },
        });
      }
      return update(args);
    });

    await execute(tool, context, { outcome: 'review', reason: 'Change request opened.' });

    expect(raced).toBe(true);
    expect((await storage.get({ orgId: 'org-1', id: prepared.item.id }))!.metadata).toMatchObject({
      lastWebhookAt: '2026-11-24T10:00:00.000Z',
      phaseOutcome: { phase: 'execute', outcome: 'review', to: 'pr-review' },
    });
  });

  it('is exposed only for the exact active tenant/thread/resource/session binding', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const prepared = await prepareBoundItem(storage);
    await storage.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: PROJECT_ID,
      input: {
        externalSource: { integrationId: 'github', type: 'pull-request', externalId: 'github-pr:99' },
        parentWorkItemId: prepared.item.id,
        title: 'Linked review',
        stages: ['intake'],
        sessions: {},
        metadata: {},
      },
    });

    await expect(createFactoryOutcomeTools({ requestContext: requestContext(), storage })).resolves.toHaveProperty(
      'factory_report_outcome',
    );
    for (const other of [{ threadId: 'other-thread' }, { resourceId: 'other-resource' }, { orgId: 'other-org' }]) {
      await expect(createFactoryOutcomeTools({ requestContext: requestContext(other), storage })).resolves.toEqual({});
    }
  });

  it('reports without asking: a report moves nothing until the board engine accepts it', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    await prepareBoundItem(storage);
    const tools = await createFactoryOutcomeTools({ requestContext: requestContext(), storage });
    expect((tools.factory_report_outcome as ExecutableTool).requireApproval).toBe(false);
  });

  it('rechecks authority at execution and rejects revoked or replaced bindings', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const prepared = await prepareBoundItem(storage);
    await inPhase(storage, prepared.item.id, 'planning');
    const context = requestContext();
    const tool = (await createFactoryOutcomeTools({ requestContext: context, storage }))
      .factory_report_outcome as ExecutableTool;
    await expect(
      execute(tool, requestContext({ threadId: 'other-thread' }), { outcome: 'advance', reason: 'Continue.' }),
    ).rejects.toThrow(/binding is unavailable, revoked, or no longer matches/);

    await storage.revokeRunBinding({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      bindingId: prepared.binding.id,
      revokedAt: new Date(),
    });

    await expect(execute(tool, context, { outcome: 'advance', reason: 'Continue.' })).rejects.toThrow(
      /binding is unavailable, revoked, or no longer matches/,
    );
  });

  it('offers a retired-session tool that fails loudly when the bound item reached a terminal stage', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const prepared = await prepareBoundItem(storage);
    // The item settles at a terminal stage, then terminal cleanup revokes the seat.
    await storage.commitTransition({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      workItemId: prepared.item.id,
      expectedRevision: prepared.item.revision,
      destinationStage: 'done',
      actorId: 'user-1',
      ingress: { identity: 'external-close', transitionId: 'external-close' },
      causalChain: [],
      evaluation: { outcome: 'accepted', decisions: [] },
    });
    await storage.revokeRunBinding({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      bindingId: prepared.binding.id,
      revokedAt: new Date(),
    });

    const tools = await createFactoryOutcomeTools({
      requestContext: requestContext(),
      storage,
      boards: createTriageWorkRegistry(),
    });
    const tool = tools.factory_report_outcome as ExecutableTool;
    expect(tool).toBeDefined();
    expect(tool.requireApproval).toBe(false);
    await expect(execute(tool, requestContext(), { outcome: 'done', reason: 'Continue.' })).rejects.toThrow(/retired/i);
  });

  it('offers no tool when a revoked binding belongs to an item still in flight', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const prepared = await prepareBoundItem(storage);
    // Binding revoked while the item stays in a working/resting lane (e.g. a peer
    // role took over on another session): not a retirement, so no tool.
    await storage.revokeRunBinding({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      bindingId: prepared.binding.id,
      revokedAt: new Date(),
    });

    await expect(
      createFactoryOutcomeTools({ requestContext: requestContext(), storage, boards: createTriageWorkRegistry() }),
    ).resolves.toEqual({});
  });

  it('rejects a session that has been re-pointed at a different work item', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const prepared = await prepareBoundItem(storage);
    await inPhase(storage, prepared.item.id, 'planning');
    const context = requestContext();
    const tool = (await createFactoryOutcomeTools({ requestContext: context, storage }))
      .factory_report_outcome as ExecutableTool;

    const other = await storage.prepareRunStart({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: PROJECT_ID,
      workItem: {
        input: {
          externalSource: { integrationId: 'github', type: 'issue', externalId: 'github-issue:2' },
          title: 'A different item',
          stages: ['planning'],
          sessions: {},
          metadata: {},
        },
      },
      role: 'work',
      session: { sessionId: 'resource-1', branch: 'factory/other', threadId: 'thread-1' },
      resourceId: 'resource-1',
      kickoffKey: 'kickoff-3',
      kickoffMessage: null,
    });

    await expect(execute(tool, context, { outcome: 'advance', reason: 'Continue.' })).rejects.toThrow(
      /binding is unavailable, revoked, or no longer matches/,
    );
    expect((await storage.get({ orgId: 'org-1', id: other.item.id }))!.metadata).not.toHaveProperty('phaseOutcome');
  });

  describe('factory_record_review_verdict', () => {
    // Work's seed has no self-review phase; a project stored before still holds one.
    const olderWork = new Map([['work', selfReviewWorkBoard]]);

    async function selfReviewingItem(storage: WorkItemsStorage, metadata: Record<string, unknown> = {}) {
      const prepared = await prepareBoundItem(storage, 'github-issue', 'review');
      await storage.update({
        orgId: 'org-1',
        id: prepared.item.id,
        userId: 'user-1',
        patch: { stages: ['review'], metadata: { authorTrusted: true, ...metadata } },
      });
      return prepared.item.id;
    }

    it('reports parking the card in Intake for a person once self-review hits the round limit', async () => {
      const storage = (await createFactoryStorageForTests()).workItems;
      const id = await selfReviewingItem(storage, { selfReviewRounds: 2 });
      const context = requestContext();
      const tools = await createFactoryOutcomeTools({ requestContext: context, storage, boards: olderWork });

      await expect(
        execute(tools.factory_record_review_verdict as ExecutableTool, context, {
          verdict: 'request changes',
          reviewedHeadSha: 'abc1234def000000000000000000000000000000',
          findings: 'Result: changes requested',
        }),
      ).resolves.toMatchObject({ selfReviewRounds: 3 });
      const item = (await storage.get({ orgId: 'org-1', id }))!;
      expect(item.stages).toEqual(['review']);
      expect(item.metadata?.phaseOutcome).toMatchObject({
        phase: 'review',
        outcome: 'park',
        to: 'intake',
        source: 'verdict',
      });
    });

    it.each([
      ['approve', undefined, 1],
      ['request changes', 'execute', 2],
    ] as const)('records a self-review %s on the Work card (outcome to %s)', async (verdict, stage, rounds) => {
      const storage = (await createFactoryStorageForTests()).workItems;
      const id = await selfReviewingItem(storage, { selfReviewRounds: 1 });
      const context = requestContext();
      const tools = await createFactoryOutcomeTools({ requestContext: context, storage, boards: olderWork });

      await expect(
        execute(tools.factory_record_review_verdict as ExecutableTool, context, {
          verdict,
          reviewedHeadSha: 'ABC1234DEF000000000000000000000000000000',
          findings: 'Result: done',
        }),
      ).resolves.toMatchObject({ status: 'recorded', verdict, selfReviewRounds: rounds });

      const item = (await storage.get({ orgId: 'org-1', id }))!;
      // The verdict never moves the card itself: Factory moves it once the reviewer's run ends.
      expect(item.stages).toEqual(['review']);
      if (stage) {
        expect(item.metadata?.phaseOutcome).toMatchObject({
          phase: 'review',
          outcome: 'request-changes',
          to: stage,
          source: 'verdict',
          reason: 'Self-review requested changes on abc1234def000000000000000000000000000000 (round 2).',
        });
      } else {
        // An approval leaves the outcome to the reviewer, which reports it once the change request is open.
        expect(item.metadata).not.toHaveProperty('phaseOutcome');
      }
      expect(item.metadata).toMatchObject({
        selfReviewVerdict: verdict,
        selfReviewedHeadSha: 'abc1234def000000000000000000000000000000',
        selfReviewFindings: 'Result: done',
        selfReviewRounds: rounds,
      });
    });

    async function reviewingItem(storage: WorkItemsStorage, stage = 'pr-review') {
      const prepared = await prepareBoundItem(storage, 'github-pr');
      await storage.update({
        orgId: 'org-1',
        id: prepared.item.id,
        userId: 'user-1',
        patch: { stages: [stage], metadata: { authorTrusted: true, factoryAuthored: true } },
      });
      return prepared.item.id;
    }

    describe("follows the card's phase, not the session's role", () => {
      const verdict = { verdict: 'approve', reviewedHeadSha: 'abc1234def000000000000000000000000000000' };
      const build = (storage: WorkItemsStorage, boards?: Parameters<typeof createFactoryOutcomeTools>[0]['boards']) =>
        createFactoryOutcomeTools({
          requestContext: requestContext(),
          storage,
          ...(boards ? { boards } : {}),
        });

      it('grants the verdict tool to the session reviewing the card in PR review, not to its builder', async () => {
        const reviewer = (await createFactoryStorageForTests()).workItems;
        await reviewingItem(reviewer);
        expect(await build(reviewer)).toHaveProperty('factory_record_review_verdict');

        const builder = (await createFactoryStorageForTests()).workItems;
        const prepared = await prepareBoundItem(builder, 'github-pr', 'work');
        await builder.update({
          orgId: 'org-1',
          id: prepared.item.id,
          userId: 'user-1',
          patch: { stages: ['pr-review'] },
        });
        expect(await build(builder)).not.toHaveProperty('factory_record_review_verdict');
      });

      it('takes the verdict tool away on the next turn once the card moves to a phase without it', async () => {
        const storage = (await createFactoryStorageForTests()).workItems;
        const id = await reviewingItem(storage);
        expect(await build(storage)).toHaveProperty('factory_record_review_verdict');

        await storage.update({ orgId: 'org-1', id, userId: 'user-1', patch: { stages: ['intake'] } });
        expect(await build(storage)).not.toHaveProperty('factory_record_review_verdict');
      });

      it('refuses a verdict when the card moved between building the tools and the call', async () => {
        const storage = (await createFactoryStorageForTests()).workItems;
        const id = await reviewingItem(storage);
        const context = requestContext();
        const tools = await createFactoryOutcomeTools({
          requestContext: context,
          storage,
        });
        await storage.update({ orgId: 'org-1', id, userId: 'user-1', patch: { stages: ['intake'] } });

        await expect(execute(tools.factory_record_review_verdict as ExecutableTool, context, verdict)).rejects.toThrow(
          'does not review the card in its current phase (intake)',
        );
        expect((await storage.get({ orgId: 'org-1', id }))?.metadata).not.toHaveProperty('reviewVerdict');
      });

      it('grants nothing to a review session in a review phase that does not list the tool', async () => {
        const board = defineBoard({
          id: 'release',
          name: 'Release',
          initialPhase: 'queued',
          phases: {
            queued: { name: 'Queued', kind: 'resting', nextPhases: ['checking', 'approving'] },
            checking: { name: 'Checking', kind: 'working', runner: { context: 'review' }, nextPhases: ['shipped'] },
            approving: {
              name: 'Approving',
              kind: 'working',
              runner: { context: 'review' },
              tools: ['factory_record_review_verdict'],
              nextPhases: ['shipped'],
            },
            shipped: { name: 'Shipped', kind: 'terminal' },
          },
        });
        const boards = boardRegistryOf([board]);
        const storage = (await createFactoryStorageForTests()).workItems;
        const prepared = await storage.prepareRunStart({
          orgId: 'org-1',
          userId: 'user-1',
          factoryProjectId: PROJECT_ID,
          workItem: {
            input: {
              board: 'release',
              title: 'Release',
              stages: ['checking'],
              externalSource: { integrationId: 'github', type: 'issue', externalId: 'release:1' },
              metadata: { authorTrusted: true },
            },
          },
          role: 'review',
          session: { sessionId: 'resource-1', branch: 'release', threadId: 'thread-1' },
          resourceId: 'resource-1',
          kickoffKey: 'release-1',
          kickoffMessage: null,
        });
        expect(await build(storage, boards)).not.toHaveProperty('factory_record_review_verdict');

        await storage.update({
          orgId: 'org-1',
          id: prepared.item.id,
          userId: 'user-1',
          patch: { stages: ['approving'] },
        });
        expect(await build(storage, boards)).toHaveProperty('factory_record_review_verdict');
      });
    });

    it('records the verdict on a card in PR review and leaves it there', async () => {
      const storage = (await createFactoryStorageForTests()).workItems;
      const id = await reviewingItem(storage);
      const context = requestContext();
      const tools = await createFactoryOutcomeTools({
        requestContext: context,
        storage,
      });

      await expect(
        execute(tools.factory_record_review_verdict as ExecutableTool, context, {
          verdict: 'request changes',
          reviewedHeadSha: 'ABC1234DEF000000000000000000000000000000',
        }),
      ).resolves.toMatchObject({ status: 'recorded', verdict: 'request changes' });

      const item = await storage.get({ orgId: 'org-1', id });
      expect(item?.stages).toEqual(['pr-review']);
      expect(item?.metadata).toMatchObject({
        factoryAuthored: true,
        reviewVerdict: 'request changes',
        reviewedHeadSha: 'abc1234def000000000000000000000000000000',
        reviewedAt: expect.any(String),
      });
    });

    it('mirrors the verdict onto the Work item that authored the pull request', async () => {
      const storage = (await createFactoryStorageForTests()).workItems;
      const id = await reviewingItem(storage);
      const parent = await storage.upsert({
        orgId: 'org-1',
        userId: 'user-1',
        factoryProjectId: PROJECT_ID,
        input: { title: 'Authoring work', stages: ['review'], metadata: { note: 'kept' } },
      });
      const reviewing = await storage.get({ orgId: 'org-1', id });
      await storage.update({
        orgId: 'org-1',
        id,
        userId: 'user-1',
        patch: { parentWorkItemId: parent.item.id, metadata: { ...reviewing?.metadata, githubPullRequestNumber: 34 } },
      });
      const context = requestContext();
      const tools = await createFactoryOutcomeTools({
        requestContext: context,
        storage,
      });

      await execute(tools.factory_record_review_verdict as ExecutableTool, context, {
        verdict: 'request changes',
        reviewedHeadSha: 'abc1234def000000000000000000000000000000',
      });

      const work = await storage.get({ orgId: 'org-1', id: parent.item.id });
      expect(work?.stages).toEqual(['review']);
      expect(work?.metadata).toMatchObject({
        note: 'kept',
        reviewVerdict: 'request changes',
        reviewedHeadSha: 'abc1234def000000000000000000000000000000',
      });
      const reviewed = await storage.get({ orgId: 'org-1', id });
      // The mirror names the pull request it covers, so the Work card's next pass is scoped the same way.
      expect(reviewed?.metadata?.reviewedPullRequestNumber).toBe(34);
      expect(work?.metadata?.reviewedPullRequestNumber).toBe(34);
    });

    it('records the published PR verdict on a pull request card reviewed on the Work board', async () => {
      const storage = (await createFactoryStorageForTests()).workItems;
      const id = await reviewingItem(storage, 'pr-review');
      const parent = await storage.upsert({
        orgId: 'org-1',
        userId: 'user-1',
        factoryProjectId: PROJECT_ID,
        input: { board: 'work', title: 'Authoring work', stages: ['review'], metadata: { openPullRequestNumber: 1 } },
      });
      await storage.update({
        orgId: 'org-1',
        id,
        userId: 'user-1',
        patch: { board: 'work', parentWorkItemId: parent.item.id },
      });
      const context = requestContext();
      const tools = await createFactoryOutcomeTools({
        requestContext: context,
        storage,
      });

      await expect(
        execute(tools.factory_record_review_verdict as ExecutableTool, context, {
          verdict: 'approve',
          reviewedHeadSha: 'ABC1234DEF000000000000000000000000000000',
          findings: 'Looks good',
        }),
      ).resolves.toMatchObject({ status: 'recorded', verdict: 'approve' });

      const item = await storage.get({ orgId: 'org-1', id });
      expect(item?.board).toBe('work');
      expect(item?.stages).toEqual(['pr-review']);
      expect(item?.metadata).toMatchObject({
        reviewVerdict: 'approve',
        reviewedHeadSha: 'abc1234def000000000000000000000000000000',
      });
      // A PR verdict is not a self-review: no self-review rounds, no builder wake-up.
      expect(item?.metadata).not.toHaveProperty('selfReviewVerdict');
      expect(item?.metadata).not.toHaveProperty('selfReviewRounds');
      expect((await storage.get({ orgId: 'org-1', id: parent.item.id }))?.metadata).toMatchObject({
        openPullRequestNumber: 1,
        reviewVerdict: 'approve',
      });
      const onResult = workBoard.tools.factory_record_review_verdict?.onResult;
      expect(
        onResult?.({
          tenant: { orgId: 'org-1', projectId: PROJECT_ID },
          actor: { type: 'agent', id: 'binding-1', role: 'review' },
          ingress: { type: 'rule', id: 'ingress-1' },
          cause: 'test',
          causalChain: [],
          configVersion: 'rules-v1',
          item: {
            id,
            source: 'github-pr',
            sourceKey: null,
            parentWorkItemId: parent.item.id,
            title: item!.title,
            url: null,
            stages: item!.stages,
            acceptedAt: null,
            metadata: item!.metadata,
          },
          board: 'work',
          itemRevision: item!.revision,
          toolName: 'factory_record_review_verdict',
          threadId: 'thread-1',
          assistantMessageId: 'message-1',
          toolCallId: 'call-1',
          result: { status: 'success', value: { status: 'recorded' } },
        }),
      ).toBeUndefined();
    });

    it('offers no verdict tool for a card that is no longer in PR review', async () => {
      const storage = (await createFactoryStorageForTests()).workItems;
      await reviewingItem(storage, 'done');
      const tools = await createFactoryOutcomeTools({
        requestContext: requestContext(),
        storage,
      });

      // Done grants no tools, so the reviewer's session loses the verdict tool with the move.
      expect(tools).not.toHaveProperty('factory_record_review_verdict');
      expect(tools).toHaveProperty('factory_report_outcome');
    });

    it('is offered only to review bindings and bounds its input', async () => {
      const storage = (await createFactoryStorageForTests()).workItems;
      await prepareBoundItem(storage, 'github-issue');
      const workTools = await createFactoryOutcomeTools({
        requestContext: requestContext(),
        storage,
      });
      expect(workTools).not.toHaveProperty('factory_record_review_verdict');

      const reviewStorage = (await createFactoryStorageForTests()).workItems;
      await reviewingItem(reviewStorage);
      const tools = await createFactoryOutcomeTools({
        requestContext: requestContext(),
        storage: reviewStorage,
      });
      const schema = (tools.factory_record_review_verdict as ExecutableTool).inputSchema;
      expect(
        schema.safeParse({ verdict: 'approve', reviewedHeadSha: 'abc1234def000000000000000000000000000000' }).success,
      ).toBe(true);
      expect(
        schema.safeParse({ verdict: 'merge', reviewedHeadSha: 'abc1234def000000000000000000000000000000' }).success,
      ).toBe(false);
      expect(schema.safeParse({ verdict: 'approve', reviewedHeadSha: 'HEAD; rm' }).success).toBe(false);
      expect(schema.safeParse({ verdict: 'approve', reviewedHeadSha: 'abc1234' }).success).toBe(false);
    });
  });

  it.each(['github-pr', 'gitlab-pr'] as const)(
    'recovers a %s review binding after crash-resume wipes session state and heals the security posture',
    async source => {
      const storage = (await createFactoryStorageForTests()).workItems;
      const prepared = await prepareBoundItem(storage, source);
      const setState = vi.fn(async () => {});
      const context = crashResumedContext(setState);
      const sessions = {
        getBySessionId: vi.fn(async () => ({ orgId: 'org-1', projectRepositoryId: 'repo-1', baseBranch: 'main' })),
      };

      const tools = await createFactoryOutcomeTools({
        requestContext: context,
        storage,
        sessions,
      });

      expect(tools).toHaveProperty('factory_report_outcome');
      expect(sessions.getBySessionId).toHaveBeenCalledWith('resource-1');
      expect(setState).toHaveBeenCalledWith({
        factoryProjectId: PROJECT_ID,
        factoryOrgId: 'org-1',
        projectRepositoryId: 'repo-1',
        untrustedCheckout: true,
        baseRef: 'main',
      });

      await inPhase(storage, prepared.item.id, 'pr-review');
      await execute(tools.factory_report_outcome as ExecutableTool, context, {
        outcome: 'done',
        reason: 'Review complete.',
      });
      expect((await storage.get({ orgId: 'org-1', id: prepared.item.id }))!.metadata?.phaseOutcome).toMatchObject({
        phase: 'pr-review',
        outcome: 'done',
        bindingId: prepared.binding.id,
      });
    },
  );

  it('keeps untrustedCheckout on recovered review bindings when enrichment lookups fail', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    await prepareBoundItem(storage, 'github-pr');
    const setState = vi.fn(async () => {});
    vi.spyOn(storage, 'get').mockRejectedValue(new Error('transient storage outage'));

    const tools = await createFactoryOutcomeTools({
      requestContext: crashResumedContext(setState),
      storage,
      sessions: { getBySessionId: vi.fn(async () => Promise.reject(new Error('sessions down'))) },
    });

    expect(tools).toHaveProperty('factory_report_outcome');
    expect(setState).toHaveBeenCalledWith({
      factoryProjectId: PROJECT_ID,
      factoryOrgId: 'org-1',
      untrustedCheckout: true,
    });
  });

  it('keeps untrustedCheckout when only the session lookup fails during enrichment', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    await prepareBoundItem(storage, 'github-pr');
    const setState = vi.fn(async () => {});
    const getBySessionId = vi.fn(async () => Promise.reject(new Error('sessions down')));

    const tools = await createFactoryOutcomeTools({
      requestContext: crashResumedContext(setState),
      storage,
      sessions: { getBySessionId },
    });

    expect(tools).toHaveProperty('factory_report_outcome');
    expect(getBySessionId).toHaveBeenCalled();
    expect(setState).toHaveBeenCalledWith({
      factoryProjectId: PROJECT_ID,
      factoryOrgId: 'org-1',
      untrustedCheckout: true,
    });
  });

  it('recovers a work binding without marking the checkout untrusted', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    await prepareBoundItem(storage);
    const setState = vi.fn(async () => {});

    const tools = await createFactoryOutcomeTools({
      requestContext: crashResumedContext(setState),
      storage,
    });

    expect(tools).toHaveProperty('factory_report_outcome');
    expect(setState).toHaveBeenCalledWith({
      factoryProjectId: PROJECT_ID,
      factoryOrgId: 'org-1',
      untrustedCheckout: false,
    });
  });

  it('exposes nothing on crash-resume when no active binding matches the thread', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    await prepareBoundItem(storage);
    const setState = vi.fn(async () => {});

    await expect(
      createFactoryOutcomeTools({
        requestContext: crashResumedContext(setState, { threadId: 'other-thread' }),
        storage,
      }),
    ).resolves.toEqual({});
    expect(setState).not.toHaveBeenCalled();
  });

  it('never authorizes on crash-resume when bindings are ambiguous across factory projects', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    await prepareBoundItem(storage);
    await storage.prepareRunStart({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: '99999999-8888-4777-8666-555555555555',
      workItem: {
        input: {
          externalSource: { integrationId: 'github', type: 'issue', externalId: 'github-issue:2' },
          title: 'Second project item',
          stages: ['intake'],
          sessions: {},
          metadata: {},
        },
      },
      role: 'work',
      session: { sessionId: 'resource-1', branch: 'factory/item', threadId: 'thread-1' },
      resourceId: 'resource-1',
      kickoffKey: 'kickoff-2',
      kickoffMessage: null,
    });

    await expect(
      createFactoryOutcomeTools({
        requestContext: crashResumedContext(vi.fn(async () => {})),
        storage,
      }),
    ).resolves.toEqual({});
  });

  it('bounds outcome and reason at the schema boundary', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    await prepareBoundItem(storage);
    const tools = await createFactoryOutcomeTools({ requestContext: requestContext(), storage });
    const schema = (tools.factory_report_outcome as ExecutableTool).inputSchema;

    expect(schema.safeParse({ outcome: 'advance', reason: 'Ready.' }).success).toBe(true);
    for (const outcome of ['', ' advance', 'advance ', 'bad/outcome', 'x'.repeat(129)]) {
      expect(schema.safeParse({ outcome, reason: 'Ready.' }).success).toBe(false);
    }
    // A session names an outcome, never a card or a phase.
    expect(schema.safeParse({ outcome: 'advance', reason: 'Ready.', workItemId: 'forged' }).success).toBe(false);
    expect(schema.safeParse({ outcome: 'advance', reason: 'Ready.', stage: 'done' }).success).toBe(false);
    expect(schema.safeParse({ outcome: 'advance', reason: '   ' }).success).toBe(false);
  });

  it('accepts and clamps an overlong reason instead of rejecting it', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    await prepareBoundItem(storage);
    const tools = await createFactoryOutcomeTools({ requestContext: requestContext(), storage });
    const schema = (tools.factory_report_outcome as ExecutableTool).inputSchema;

    const overlong = schema.safeParse({ outcome: 'advance', reason: 'x'.repeat(1_792) }) as {
      success: boolean;
      data?: { reason: string };
    };
    expect(overlong.success).toBe(true);
    expect(overlong.data?.reason).toHaveLength(1_000);
    expect(overlong.data?.reason.endsWith('…')).toBe(true);

    const exact = schema.safeParse({ outcome: 'advance', reason: 'y'.repeat(1_000) }) as {
      success: boolean;
      data?: { reason: string };
    };
    expect(exact.success).toBe(true);
    expect(exact.data?.reason).toBe('y'.repeat(1_000));
  });
});
