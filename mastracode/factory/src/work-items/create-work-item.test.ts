import { randomUUID } from 'node:crypto';

import { LibSQLFactoryStorage } from '@mastra/libsql';
import { PgFactoryStorage } from '@mastra/pg';
import { describe, expect, it, onTestFinished } from 'vitest';

import { boardRegistryOf, createBoardRegistry, defineBoard } from '../boards/index.js';
import { FactoryTransitionService } from '../rules/transition-service.js';
import { StoredBoardsStorage } from '../storage/domains/boards/base.js';
import type { StoredIntakeRouteInput } from '../storage/domains/boards/base.js';
import { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import type { CreateWorkItemInput } from '../storage/domains/work-items/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { createFactoryWorkItem } from './create-work-item.js';
import type { CreateFactoryWorkItemArgs, CreateFactoryWorkItemResult } from './create-work-item.js';

const DOCS = {
  operator: 'AND',
  conditions: [{ field: 'item.labels', operator: 'contains', value: 'docs' }],
} as const;

async function setup(routes: StoredIntakeRouteInput[] = []) {
  const seed = await createFactoryStorageForTests();
  const project = await seed.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Cards' } });
  const scope = { orgId: 'org-1', factoryProjectId: project.id };
  for (const route of routes) await seed.boards.createIntakeRoute(scope, route, 'admin');
  const boards = createBoardRegistry();
  const transitionService = new FactoryTransitionService({
    storage: seed.workItems,
    configVersion: 'cards-v1',
    boards,
  });
  const create = (input: CreateWorkItemInput, { withRoutes = true } = {}) =>
    createFactoryWorkItem({
      workItems: seed.workItems,
      boards,
      transitionService,
      audit: async () => {},
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
      input,
      ...(withRoutes ? { intakeRoutes: seed.boards } : {}),
    });
  return { create, seed, project };
}

describe('createFactoryWorkItem with intake routes', () => {
  const toPlanning: StoredIntakeRouteInput = {
    name: 'Docs to planning',
    when: DOCS,
    target: { boardKey: 'work', phaseKey: 'planning' },
  };

  it('files a card without a board where the first matching route says, entering through Intake', async () => {
    const { create } = await setup([toPlanning]);
    const created = await create({ title: 'Write the guide', metadata: { labels: ['docs'] } });
    expect(created.status).toBe('created');
    if (created.status !== 'created') return;
    expect(created.item).toMatchObject({ board: 'work', stages: ['planning'] });
    expect(created.item.stageHistory.map(entry => entry.stage)).toEqual(['intake', 'planning']);
    expect(created.item.metadata).toMatchObject({ labels: ['docs'], intakeRouteId: expect.any(String) });
  });

  it("doesn't count the route's move as the person's consent to start work", async () => {
    const { create, seed, project } = await setup([toPlanning]);
    const created = await create({ title: 'Write the guide', metadata: { labels: ['docs'] } });
    expect(created).toMatchObject({ status: 'created', item: { stages: ['planning'] } });
    if (created.status !== 'created') return;
    expect(created.item.autonomyArmedAt).toBeNull();
    const decisions = await seed.workItems.listDeferredDecisions('org-1', project.id);
    expect(decisions.filter(decision => decision.workItemId === created.item.id).length).toBeGreaterThan(0);
    for (const decision of decisions) expect(decision).toMatchObject({ approvedAt: null, approvedBy: null });
  });

  it('leaves a card no route matches in the default first phase', async () => {
    const { create } = await setup([toPlanning]);
    const created = await create({ title: 'Fix the build', metadata: { labels: ['bug'] } });
    expect(created).toMatchObject({ status: 'created', item: { board: 'work', stages: ['intake'] } });
  });

  it('ignores routes when the person named the board or the stages', async () => {
    const { create } = await setup([toPlanning]);
    expect(await create({ title: 'Named board', board: 'work', metadata: { labels: ['docs'] } })).toMatchObject({
      status: 'created',
      item: { board: 'work', stages: ['intake'] },
    });
    expect(await create({ title: 'Named stages', stages: ['intake'], metadata: { labels: ['docs'] } })).toMatchObject({
      status: 'created',
      item: { board: 'work', stages: ['intake'] },
    });
  });

  it('places nothing without a routes reader', async () => {
    const { create } = await setup([toPlanning]);
    expect(
      await create({ title: 'Write the guide', metadata: { labels: ['docs'] } }, { withRoutes: false }),
    ).toMatchObject({
      status: 'created',
      item: { board: 'work', stages: ['intake'] },
    });
  });

  it('files a trusted pull request in Work › PR review by the default route, and an outside one in Intake', async () => {
    const { create } = await setup();
    const pullRequest = (externalId: string, authorTrusted: boolean) =>
      create({
        title: `Review the patch ${externalId}`,
        externalSource: {
          integrationId: 'github',
          type: 'pull-request',
          externalId,
          url: `https://github.com/acme/app/pull/${externalId}`,
        },
        metadata: { authorTrusted },
      });
    const trusted = await pullRequest('7', true);
    expect(trusted).toMatchObject({ status: 'created', item: { board: 'work', stages: ['pr-review'] } });
    if (trusted.status !== 'created') return;
    expect(trusted.item.stageHistory.map(entry => entry.stage)).toEqual(['intake', 'pr-review']);
    expect(await pullRequest('8', false)).toMatchObject({
      status: 'created',
      item: { board: 'work', stages: ['intake'] },
    });
  });
});

/** A board that isn't Work, so nothing can reach it by naming a default. */
const deskBoard = defineBoard({
  id: 'desk',
  name: 'Desk',
  initialPhase: 'inbox',
  phases: {
    inbox: { name: 'Inbox', kind: 'resting', nextPhases: ['triage', 'done'] },
    triage: { name: 'Triage', kind: 'resting', nextPhases: ['done'] },
    done: { name: 'Done', kind: 'terminal' },
  },
});

describe('createFactoryWorkItem under the intake order evaluator', () => {
  /** A project with only the Desk board and none of the seeded rules, filing with `evaluator`. */
  async function setupDesk(
    routes: StoredIntakeRouteInput[],
    evaluator: 'intake-order' | 'route-list',
    { withRules = true }: { withRules?: boolean } = {},
  ) {
    const seed = await createFactoryStorageForTests();
    const project = await seed.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Desk' } });
    const scope = { orgId: 'org-1', factoryProjectId: project.id };
    for (const seeded of (await seed.boards.listIntakeRoutes(scope)).toReversed()) {
      await seed.boards.deleteIntakeRoute(scope, seeded.id, { expectedRevision: seeded.revision });
    }
    for (const route of routes) await seed.boards.createIntakeRoute(scope, route, 'admin');
    const boards = boardRegistryOf([deskBoard]);
    const transitionService = new FactoryTransitionService({ storage: seed.workItems, configVersion: 'v1', boards });
    const create = (input: CreateWorkItemInput) =>
      createFactoryWorkItem({
        workItems: seed.workItems,
        boards,
        transitionService,
        audit: async () => {},
        orgId: 'org-1',
        userId: 'user-1',
        factoryProjectId: project.id,
        input,
        ...(withRules ? { intakeRoutes: seed.boards } : {}),
        intakeEvaluator: evaluator,
      });
    return { create, seed, scope };
  }
  const docsToTriage: StoredIntakeRouteInput = {
    name: 'Docs to triage',
    when: DOCS,
    target: { boardKey: 'desk', phaseKey: 'triage' },
  };

  it("files a card the board's rules match on that board, without any board named Work", async () => {
    const { create, scope } = await setupDesk([docsToTriage], 'intake-order');
    const created = await create({ title: 'Write the guide', metadata: { labels: ['docs'] } });
    expect(created).toMatchObject({ status: 'created', item: { board: 'desk', stages: ['triage'] } });
  });

  it('refuses a card no board takes, asking the person for the board, and files nothing', async () => {
    const { create, seed, scope } = await setupDesk([docsToTriage], 'intake-order');
    const refused = await create({ title: 'Fix the build', metadata: { labels: ['bug'] } });
    expect(refused).toMatchObject({
      status: 'refused',
      code: 'intake_board_required',
      message: expect.stringContaining('Pick the board'),
    });
    expect(await seed.workItems.list(scope)).toEqual([]);
    // Naming the board files it.
    expect(await create({ title: 'Fix the build', board: 'desk' })).toMatchObject({
      status: 'created',
      item: { board: 'desk', stages: ['inbox'] },
    });
  });

  it('lets the rules pick the board of a card that names only its stages', async () => {
    const { create } = await setupDesk([docsToTriage], 'intake-order');
    expect(await create({ title: 'Guide', stages: ['inbox'], metadata: { labels: ['docs'] } })).toMatchObject({
      status: 'created',
      item: { board: 'desk', stages: ['inbox'] },
    });
    expect(await create({ title: 'Bug', stages: ['inbox'] })).toMatchObject({
      status: 'refused',
      code: 'intake_board_required',
    });
  });

  it('refuses a card without a board while the intake rules are unavailable, rather than guess one', async () => {
    const { create, seed, scope } = await setupDesk([docsToTriage], 'intake-order', { withRules: false });
    expect(await create({ title: 'Write the guide', metadata: { labels: ['docs'] } })).toMatchObject({
      status: 'refused',
      code: 'intake_board_required',
    });
    expect(await seed.workItems.list(scope)).toEqual([]);
    expect(await create({ title: 'Write the guide', board: 'desk' })).toMatchObject({ status: 'created' });
  });

  it('keeps filing an unmatched card on the first board under the old evaluator', async () => {
    const { create } = await setupDesk([docsToTriage], 'route-list');
    expect(await create({ title: 'Fix the build', metadata: { labels: ['bug'] } })).toMatchObject({
      status: 'created',
      item: { board: 'desk', stages: ['inbox'] },
    });
  });
});

// Set FACTORY_TEST_POSTGRES_URL to a disposable database to also run on PostgreSQL.
const postgresUrl = process.env.FACTORY_TEST_POSTGRES_URL;

/** A board whose first phase refuses every new card. */
const gatedBoard = defineBoard({
  id: 'gated',
  name: 'Gated',
  initialPhase: 'inbox',
  transitionPolicy: context =>
    context.initialEntry ? { type: 'reject', code: 'forbidden', reason: 'Closed for filing' } : { type: 'allow' },
  phases: {
    inbox: { name: 'Inbox', kind: 'resting', nextPhases: ['done'] },
    done: { name: 'Done', kind: 'terminal' },
  },
});

// Not GitHub or GitLab, which the project's default intake route catches first.
const source = { integrationId: 'linear', type: 'issue', externalId: 'ENG-42' } as const;

/** A board whose first phase takes every new card but whose later phases refuse it. */
const closingBoard = defineBoard({
  id: 'closing',
  name: 'Closing',
  initialPhase: 'inbox',
  transitionPolicy: context =>
    context.initialEntry ? { type: 'allow' } : { type: 'reject', code: 'forbidden', reason: 'Closed for moves' },
  phases: {
    inbox: { name: 'Inbox', kind: 'resting', nextPhases: ['review'] },
    review: { name: 'Review', kind: 'resting' },
  },
});

describe('createFactoryWorkItem card numbers', () => {
  it('numbers cards filed by hand in sequence, and leaves cards from an issue to their issue number', async () => {
    const { create } = await setup();
    const first = await create({ title: 'First' });
    const second = await create({ title: 'Second', metadata: { repository: 'mastra-ai/mastra' } });
    const synced = await create({
      title: 'From an issue',
      externalSource: { integrationId: 'github', type: 'issue', externalId: 'issue-7' },
      metadata: { number: 7 },
    });
    expect(first).toMatchObject({ status: 'created', item: { metadata: { cardNumber: 1 } } });
    expect(second).toMatchObject({
      status: 'created',
      item: { metadata: { cardNumber: 2, repository: 'mastra-ai/mastra' } },
    });
    expect(synced.status).toBe('created');
    if (synced.status !== 'created') return;
    expect(synced.item.metadata?.cardNumber).toBeUndefined();
  });
});

/**
 * The steps of a create, after its upsert, that a concurrent create for the
 * same source can land before (or, for `entered`, just after the first phase's entry).
 */
type Step = 'route-stamp' | 'initial-entry' | 'entered' | 'route-move' | 'rollback';

describe.each(['libsql', ...(postgresUrl ? ['postgres'] : [])])(
  'createFactoryWorkItem racing a create for the same source on %s',
  backend => {
    async function setup(routes: StoredIntakeRouteInput[] = []) {
      const storage =
        backend === 'postgres'
          ? new PgFactoryStorage({ id: 'create-work-item-test', connectionString: postgresUrl! })
          : new LibSQLFactoryStorage({ id: 'create-work-item-test', url: ':memory:' });
      const workItems = storage.registerDomain(new WorkItemsStorage());
      const projects = storage.registerDomain(new FactoryProjectsStorage());
      const intakeRoutes = storage.registerDomain(new StoredBoardsStorage());
      await storage.init();
      onTestFinished(() => storage.close());
      // The Postgres database is shared across runs, so every test gets its own org.
      const orgId = `org-${randomUUID()}`;
      const project = await projects.create({ orgId, userId: 'user-1', input: { name: 'Cards' } });
      const scope = { orgId, userId: 'user-1', factoryProjectId: project.id };
      for (const route of routes) {
        await intakeRoutes.createIntakeRoute({ orgId, factoryProjectId: project.id }, route, 'admin');
      }
      const boards = createBoardRegistry({ boards: [gatedBoard, closingBoard] });
      const service = new FactoryTransitionService({ storage: workItems, configVersion: 'test', boards });
      const create = (
        input: CreateWorkItemInput,
        // `null` files with Factory transitions unavailable.
        transitionService: CreateFactoryWorkItemArgs['transitionService'] | null = service,
      ): Promise<CreateFactoryWorkItemResult> =>
        createFactoryWorkItem({
          workItems,
          boards,
          transitionService: transitionService ?? undefined,
          audit: async () => {},
          intakeRoutes,
          ...scope,
          input,
        });

      /**
       * Runs `first` with a second create for the same source landing just
       * before the given step, through the real storage and transition service.
       * A reuse only refreshes source facts and keeps the revision, so `edit`
       * also has someone edit the card's own metadata then, which moves it.
       */
      async function race(
        step: Step,
        first: CreateWorkItemInput,
        secondInput: CreateWorkItemInput,
        { transitions = true, edit = false } = {},
      ) {
        let second: Promise<CreateFactoryWorkItemResult> | undefined;
        const interleave = async () => {
          second ??= create(secondInput).then(async reused => {
            if (edit && reused.status === 'reused') {
              const edited = await update({
                orgId,
                id: reused.item.id,
                userId: 'user-2',
                patch: { metadata: { note: 'edited meanwhile' } },
              });
              expect(edited?.item.revision, 'the edit moved the revision').toBeGreaterThan(reused.item.revision);
            }
            return reused;
          });
          await second;
        };
        const update = workItems.update.bind(workItems);
        workItems.update = async args => {
          if (step === 'route-stamp') await interleave();
          return update(args);
        };
        const remove = workItems.delete.bind(workItems);
        workItems.delete = async args => {
          if (step === 'rollback') await interleave();
          return remove(args);
        };
        const transitionService: CreateFactoryWorkItemArgs['transitionService'] = {
          transition: async request => {
            const at = request.ingress.identity.endsWith(':intake-route') ? 'route-move' : 'initial-entry';
            if (at === step) await interleave();
            const transitioned = await service.transition(request);
            if (at === 'initial-entry' && step === 'entered') await interleave();
            return transitioned;
          },
        };
        const result = await create(first, transitions ? transitionService : null).finally(() => {
          workItems.update = update;
          workItems.delete = remove;
        });
        expect(second, `nothing ran before the ${step}`).toBeDefined();
        return { first: result, second: await second! };
      }

      const stored = (id: string) => workItems.getForProject(orgId, project.id, id);
      const list = () => workItems.list({ orgId, factoryProjectId: project.id });
      return { create, race, stored, list };
    }

    function sameCard(first: CreateFactoryWorkItemResult, second: CreateFactoryWorkItemResult) {
      expect(first.status).toBe('created');
      expect(second.status).toBe('reused');
      const id = first.status === 'created' ? first.item.id : undefined;
      expect(second.status === 'reused' ? second.item.id : undefined).toBe(id);
      return id!;
    }

    it('keeps a card that a concurrent create reused before it entered its first phase', async () => {
      const { race, stored } = await setup();

      const { first, second } = await race(
        'initial-entry',
        { title: 'First filing', externalSource: source },
        { title: 'Second filing', externalSource: source },
        { edit: true },
      );

      const id = sameCard(first, second);
      expect(await stored(id)).toMatchObject({
        title: 'Second filing',
        stages: ['intake'],
        metadata: { note: 'edited meanwhile' },
      });
    });

    const toPlanning: StoredIntakeRouteInput = {
      name: 'Docs to planning',
      when: DOCS,
      target: { boardKey: 'work', phaseKey: 'planning' },
    };

    it.each(['route-stamp', 'initial-entry', 'route-move'] as const)(
      'still routes a card that a concurrent create reused before its %s',
      async step => {
        const { race, stored } = await setup([toPlanning]);

        const { first, second } = await race(
          step,
          { title: 'First filing', externalSource: source, metadata: { labels: ['docs'] } },
          { title: 'Second filing', externalSource: source, metadata: { labels: ['docs'] } },
          { edit: true },
        );

        const id = sameCard(first, second);
        const card = await stored(id);
        expect(card).toMatchObject({ title: 'Second filing', board: 'work', stages: ['planning'] });
        expect(card?.metadata).toMatchObject({ intakeRouteId: expect.any(String), note: 'edited meanwhile' });
        expect(card?.stageHistory.map(entry => entry.stage)).toEqual(['intake', 'planning']);
      },
    );

    const toClosing: StoredIntakeRouteInput = {
      name: 'Docs to closing',
      when: DOCS,
      target: { boardKey: 'closing', phaseKey: 'review' },
    };

    it('removes a card nobody else touched when its route move is refused', async () => {
      const { create, list } = await setup([toClosing]);

      const refused = await create({ title: 'Refused', externalSource: source, metadata: { labels: ['docs'] } });

      expect(refused).toMatchObject({ status: 'rejected', code: 'forbidden' });
      expect(await list()).toEqual([]);
    });

    it('keeps a card that a concurrent create reused after it entered its first phase, when the route move is refused', async () => {
      const { race, list } = await setup([toClosing]);

      const { first, second } = await race(
        'entered',
        { title: 'First filing', externalSource: source, metadata: { labels: ['docs'] } },
        { title: 'Second filing', externalSource: source, metadata: { labels: ['docs'] } },
      );

      expect(first).toMatchObject({ status: 'rejected', code: 'forbidden' });
      expect(second.status).toBe('reused');
      expect(await list()).toMatchObject([
        { id: second.status === 'reused' ? second.item.id : '', board: 'closing', stages: ['inbox'] },
      ]);
    });

    it('removes a refused card nobody else touched', async () => {
      const { create, list } = await setup();

      const refused = await create({ title: 'Refused', board: 'gated', externalSource: source });

      expect(refused).toMatchObject({ status: 'rejected', code: 'forbidden' });
      expect(await list()).toEqual([]);
    });

    it('keeps a refused card that a concurrent create already returned as reused', async () => {
      const { race, stored } = await setup();

      const { first, second } = await race(
        'initial-entry',
        { title: 'First filing', board: 'gated', externalSource: source },
        { title: 'Second filing', board: 'gated', externalSource: source },
      );

      expect(first).toMatchObject({ status: 'rejected', code: 'forbidden' });
      expect(second.status).toBe('reused');
      const id = second.status === 'reused' ? second.item.id : undefined;
      expect(await stored(id!)).toMatchObject({ title: 'Second filing', stages: ['inbox'] });
    });

    it('keeps a refused card that a concurrent create reused just before the rollback', async () => {
      const { race, list } = await setup();

      const { first, second } = await race(
        'rollback',
        { title: 'First filing', board: 'gated', externalSource: source },
        { title: 'Second filing', board: 'gated', externalSource: source },
      );

      expect(first).toMatchObject({ status: 'rejected', code: 'forbidden' });
      expect(second.status).toBe('reused');
      expect(await list()).toMatchObject([
        { id: second.status === 'reused' ? second.item.id : '', title: 'Second filing', stages: ['inbox'] },
      ]);
    });

    it('keeps a card that a concurrent create reused while transitions were unavailable', async () => {
      const { race, list } = await setup();

      const { first, second } = await race(
        'rollback',
        { title: 'First filing', externalSource: source },
        { title: 'Second filing', externalSource: source },
        { transitions: false },
      );

      expect(first).toMatchObject({ status: 'refused', code: 'factory_transitions_unavailable' });
      expect(second.status).toBe('reused');
      expect(await list()).toMatchObject([
        { id: second.status === 'reused' ? second.item.id : '', title: 'Second filing' },
      ]);
    });

    it('still removes a card nobody reused while transitions were unavailable', async () => {
      const { create, list } = await setup();

      const refused = await create({ title: 'Unplaced', externalSource: source }, null);

      expect(refused).toMatchObject({ status: 'refused', code: 'factory_transitions_unavailable' });
      expect(await list()).toEqual([]);
    });
  },
);
