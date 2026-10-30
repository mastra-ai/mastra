import { describe, expect, it } from 'vitest';

import { defineBoard, reviewBoard, workBoard } from '../boards/index.js';
import type { BoardRegistry } from '../boards/index.js';
import type { StoredIntakeRouteInput } from '../storage/domains/boards/base.js';
import type { ExternalWorkItemSource, WorkItemRow } from '../storage/domains/work-items/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { FactoryDecisionDispatcher } from './dispatcher.js';
import { FactoryTransitionService } from './transition-service.js';

const DOCS = {
  operator: 'AND' as const,
  conditions: [{ field: 'item.labels' as const, operator: 'contains' as const, value: 'docs' }],
};

const SOURCES: Record<string, ExternalWorkItemSource> = {
  'github issue': { integrationId: 'github', type: 'issue', externalId: 'github-issue:1' },
  'github pull request': { integrationId: 'github', type: 'pull-request', externalId: 'github-pr:1' },
  'gitlab issue': { integrationId: 'gitlab', type: 'issue', externalId: 'gitlab-issue:1' },
  'gitlab merge request': { integrationId: 'gitlab', type: 'pull-request', externalId: 'gitlab-pr:1' },
};

/** The stamps a card from each kind of author carries; a missing stamp must count as untrusted. */
const AUTHORS = {
  outsider: { held: true, metadata: { authorTrusted: false } },
  'unstamped author': { held: true, metadata: {} },
  maintainer: { held: false, metadata: { authorTrusted: true } },
  'Factory itself': { held: false, metadata: { authorTrusted: false, factoryAuthored: true } },
} as const;

/** Work with its Building phase starting on its own, as a board author can declare it. */
function boardsWithAutoStartingBuild(): BoardRegistry {
  const board = defineBoard({
    id: 'work',
    name: 'Work',
    initialPhase: 'intake',
    sourceClosed: workBoard.sourceClosed,
    transitionPolicy: workBoard.transitionPolicy,
    phases: { ...workBoard.phases, execute: { ...workBoard.phases.execute, autoStart: true } },
  });
  return new Map([
    [board.id, board],
    [reviewBoard.id, reviewBoard],
  ]);
}

async function setup(options: { routes?: StoredIntakeRouteInput[]; withReader?: boolean } = {}) {
  const seed = await createFactoryStorageForTests();
  const project = await seed.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Hold' } });
  const scope = { orgId: 'org-1', factoryProjectId: project.id };
  for (const route of options.routes ?? []) await seed.boards.createIntakeRoute(scope, route, 'admin');
  const reader = options.withReader === false ? {} : { intakeRoutes: seed.boards };
  const storage = seed.workItems;
  let deliveries = 0;
  let cards = 0;

  const card = async (input: {
    metadata: Record<string, unknown>;
    source?: ExternalWorkItemSource;
    stage?: string;
    armed?: boolean;
  }) => {
    cards += 1;
    const base = input.source ?? SOURCES['github issue']!;
    const source = { ...base, externalId: `${base.externalId}-${cards}` };
    const { item } = await storage.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
      input: {
        externalSource: source,
        title: 'Card',
        stages: [input.stage ?? 'triage'],
        sessions: {},
        metadata: input.metadata,
      },
    });
    if (!input.armed) return item;
    // Arming is a property of a committed transition: a same-lane commit carrying a person's consent.
    await storage.commitTransition({
      orgId: 'org-1',
      factoryProjectId: project.id,
      workItemId: item.id,
      expectedRevision: item.revision,
      destinationStage: item.stages[0]!,
      actorId: 'user-1',
      ingress: { identity: `arm-${item.id}`, triggerType: 'human', transitionId: `arm-${item.id}` },
      configVersion: 'hold-v1',
      causalChain: [],
      evaluation: { outcome: 'accepted', decisions: [] },
      autonomy: 'arm',
    });
    const armed = await storage.get({ orgId: 'org-1', id: item.id });
    expect(armed?.autonomyArmedAt).toBeInstanceOf(Date);
    return armed!;
  };

  /** Queues the run an outside event asks for on `item`, lets the dispatcher decide, and returns the decision's status. */
  const startRun = async (
    item: WorkItemRow,
    options: { autoRun?: boolean; boards?: BoardRegistry; role?: string } = {},
  ) => {
    deliveries += 1;
    const ingress = `delivery-${deliveries}`;
    const current = await storage.get({ orgId: 'org-1', id: item.id });
    await storage.commitRuleEvaluation({
      orgId: 'org-1',
      factoryProjectId: project.id,
      workItemId: item.id,
      ingress: { identity: ingress, triggerType: 'github' },
      configVersion: 'hold-v1',
      expectedRevision: current!.revision,
      actor: { type: 'github', login: 'stranger', trusted: false, factoryAuthored: false },
      outcome: { status: 'accepted' },
      decisions: [
        { type: 'invokeSkill', role: options.role ?? 'triage', skillName: 'factory-triage', idempotencyKey: ingress },
      ],
      causalChain: [],
      now: new Date('2030-01-01T00:00:00Z'),
    });
    await new FactoryDecisionDispatcher({
      controller: {} as never,
      transitionService: new FactoryTransitionService({ storage, configVersion: 'hold-v1', ...reader }),
      storage,
      ...(options.boards ? { boards: options.boards } : {}),
      ...reader,
      ownerId: 'worker-hold',
      isAutoRunEnabled: async () => options.autoRun ?? false,
    }).runOnce(new Date('2030-01-01T00:00:00Z'));
    const decision = (await storage.listDeferredDecisions('org-1', project.id)).find(
      entry => entry.idempotencyKey === ingress,
    );
    return decision!.status;
  };

  /** An agent bound to the card moving it from where it rests into a working phase. */
  const agentMove = async (item: WorkItemRow, stage = 'planning') =>
    new FactoryTransitionService({ storage, configVersion: 'hold-v1', ...reader }).transition({
      orgId: 'org-1',
      factoryProjectId: project.id,
      workItemId: item.id,
      board: item.externalSource?.type === 'pull-request' ? 'review' : 'work',
      stage,
      expectedRevision: item.revision,
      actor: { type: 'agent', bindingId: 'binding-1', role: 'work' },
      ingress: { type: 'agent', identity: `agent-${item.id}-${stage}-${item.revision}` },
      cause: 'agent move',
    });

  return { storage, scope, seed, card, startRun, agentMove };
}

const held = (status: string) => status === 'proposed';

describe('the intake hold with no routes configured', () => {
  for (const [author, { held: expected, metadata }] of Object.entries(AUTHORS)) {
    it(`${expected ? 'holds' : 'does not hold'} a run on a card from ${author} with auto-run on`, async () => {
      const { card, startRun } = await setup();
      expect(held(await startRun(await card({ metadata }), { autoRun: true }))).toBe(expected);
    });

    it(`${expected ? 'holds' : 'does not hold'} a run on a card from ${author} that a person armed`, async () => {
      const { card, startRun } = await setup();
      expect(held(await startRun(await card({ metadata, armed: true })))).toBe(expected);
    });

    it(`${expected ? 'holds' : 'does not hold'} a run on a card from ${author} in a phase that starts on its own`, async () => {
      const { card, startRun } = await setup();
      const item = await card({ metadata, stage: 'execute' });
      expect(held(await startRun(item, { role: 'work', boards: boardsWithAutoStartingBuild() }))).toBe(expected);
    });
  }

  for (const [label, source] of Object.entries(SOURCES)) {
    it(`refuses an agent moving an outsider's ${label} into a working phase`, async () => {
      const { card, agentMove } = await setup();
      const item = await card({ metadata: { authorTrusted: false }, source, stage: 'intake' });
      const stage = source.type === 'pull-request' ? 'review' : 'planning';
      expect(await agentMove(item, stage)).toMatchObject({
        status: 'rejected',
        code: 'approval_required',
        reason: 'This card comes from outside the write-access circle; a person must resume it from the Factory board.',
      });
    });
  }

  it('lets an agent move an unstamped card only once it is stamped trusted', async () => {
    const { card, agentMove, storage } = await setup();
    const item = await card({ metadata: {}, stage: 'intake' });
    expect(await agentMove(item)).toMatchObject({ status: 'rejected', code: 'approval_required' });
    const stamped = (
      await storage.update({
        orgId: 'org-1',
        id: item.id,
        userId: 'user-1',
        patch: { metadata: { authorTrusted: true } },
      })
    ).item;
    expect(await agentMove(stamped!)).toMatchObject({ status: 'accepted' });
  });

  it('holds the same as with an empty route list when no routes reader is wired', async () => {
    const { card, startRun, agentMove } = await setup({ withReader: false });
    expect(held(await startRun(await card({ metadata: {} }), { autoRun: true }))).toBe(true);
    expect(await agentMove(await card({ metadata: {}, stage: 'intake' }))).toMatchObject({
      code: 'approval_required',
    });
  });

  it("releases an outsider's card once a reconcile stamps the author trusted, without any route change", async () => {
    const { card, startRun, storage } = await setup();
    const item = await card({ metadata: { authorTrusted: false } });
    expect(await startRun(item, { autoRun: true })).toBe('proposed');
    await storage.update({
      orgId: 'org-1',
      id: item.id,
      userId: 'user-1',
      patch: { metadata: { authorTrusted: true } },
    });
    expect(await startRun(item, { autoRun: true })).not.toBe('proposed');
  });
});

describe('the intake hold a route sets', () => {
  it("releases an outsider's card a route marks hold: 'never'", async () => {
    const { card, startRun, agentMove } = await setup({
      routes: [{ name: 'Docs need no person', when: DOCS, hold: 'never' }],
    });
    const docs = await card({ metadata: { authorTrusted: false, labels: ['docs'] } });
    expect(await startRun(docs, { autoRun: true })).not.toBe('proposed');
    const resting = await card({
      metadata: { authorTrusted: false, labels: ['docs'] },
      source: SOURCES['gitlab issue'],
      stage: 'intake',
    });
    expect(await agentMove(resting)).toMatchObject({ status: 'accepted' });

    // The route only speaks for the cards it matches.
    const other = await card({ metadata: { authorTrusted: false, labels: ['bug'] }, source: SOURCES['gitlab issue'] });
    expect(await startRun(other, { autoRun: true })).toBe('proposed');
  });

  it("holds a maintainer's card a route marks hold: 'always'", async () => {
    const { card, startRun, agentMove } = await setup({
      routes: [{ name: 'Docs need a person', when: DOCS, hold: 'always' }],
    });
    const docs = await card({ metadata: { authorTrusted: true, labels: ['docs'] } });
    expect(await startRun(docs, { autoRun: true })).toBe('proposed');
    expect(
      await agentMove(await card({ metadata: { authorTrusted: true, labels: ['docs'] }, stage: 'intake' })),
    ).toMatchObject({
      status: 'rejected',
      code: 'approval_required',
      reason:
        "This project's intake routes hold this card for a person; a person must resume it from the Factory board.",
    });
  });

  it('keeps an outsider held under a route that only places the card', async () => {
    const { card, startRun, agentMove } = await setup({
      routes: [{ name: 'Docs to planning', when: DOCS, target: { boardKey: 'work', phaseKey: 'planning' } }],
    });
    const docs = await card({ metadata: { authorTrusted: false, labels: ['docs'] } });
    expect(await startRun(docs, { autoRun: true })).toBe('proposed');
    expect(
      await agentMove(await card({ metadata: { authorTrusted: false, labels: ['docs'] }, stage: 'intake' })),
    ).toMatchObject({ status: 'rejected', code: 'approval_required' });
  });

  it('obeys the first matching route and ignores disabled ones', async () => {
    const { card, startRun } = await setup({
      routes: [
        { name: 'Disabled release', when: DOCS, hold: 'never', enabled: false },
        { name: 'Docs need a person', when: DOCS, hold: 'always' },
        { name: 'Everything else released', when: null, hold: 'never' },
      ],
    });
    expect(
      await startRun(await card({ metadata: { authorTrusted: false, labels: ['docs'] } }), { autoRun: true }),
    ).toBe('proposed');
    expect(
      await startRun(await card({ metadata: { authorTrusted: false, labels: ['bug'] } }), { autoRun: true }),
    ).not.toBe('proposed');
  });
});
