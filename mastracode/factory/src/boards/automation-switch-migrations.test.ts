import { randomUUID } from 'node:crypto';

import type { FactoryStorageOps } from '@mastra/core/storage';
import { LibSQLFactoryStorage } from '@mastra/libsql';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import type { StoredBoardInput, StoredBoardScope } from '../storage/domains/boards/base.js';
import { createFactoryStorageForTests, createIsolatedFactoryPostgresForTests } from '../storage/test-utils.js';
import { defineBoard } from './define-board.js';
import { occupiedPhasesOf, ProjectBoardCache } from './project-boards.js';
import { createBoardRegistry } from './registry.js';
import type { BoardRegistry } from './registry.js';
import { boardDefinitionOf } from './stored-board.js';
import { BOARD_MIGRATIONS, workSeedWithSelfReview } from './work-migrations.js';
import { workBoard } from './work.js';

const postgresUrl = process.env.FACTORY_TEST_POSTGRES_URL;

/** Work as Factory seeds it today: no phase starts on its own. */
const WORK = boardDefinitionOf(workBoard);
const WORKING = WORK.phases.filter(phase => phase.kind === 'working').map(phase => phase.key);

describe.each(['libsql', ...(postgresUrl ? ['postgres'] : [])])(
  "the retired project automation switches carried into a project's boards on %s",
  backend => {
    /**
     * A project as the release before this one left it: `switches` are the columns its settings
     * page wrote, `stored` the boards it already stored.
     */
    async function setup(
      switches: { auto_run_enabled?: boolean; self_review_enabled?: boolean },
      stored: StoredBoardInput[] = [],
      codeRegistry: BoardRegistry = createBoardRegistry(),
    ) {
      const storage =
        backend === 'postgres'
          ? await createIsolatedFactoryPostgresForTests(postgresUrl!)
          : new LibSQLFactoryStorage({ id: `automation-switches-${randomUUID()}`, url: ':memory:' });
      if (backend === 'libsql') onTestFinished(() => storage.close());
      const seed = await createFactoryStorageForTests(storage);
      const project = await seed.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Acme' } });
      await seed.storage.ops.updateMany('factory_projects', { id: project.id }, switches);
      const scope: StoredBoardScope = { orgId: 'org-1', factoryProjectId: project.id };
      if (stored.length > 0) await seed.boards.seedBoards(scope, stored);
      const warn = vi.fn();
      /**
       * A Factory process loading the project, wired as MastraFactory wires its board cache;
       * `cards: false` stands for a process whose work-items domain isn't ready yet.
       */
      const load = (options: { cards?: boolean } = {}) =>
        new ProjectBoardCache({
          codeRegistry,
          storage: seed.boards,
          projects: seed.projects,
          ...(options.cards === false ? {} : { occupiedPhases: occupiedPhasesOf(seed.workItems) }),
          warn,
        }).load(scope);
      const card = (stage: string, board = 'work') =>
        seed.workItems.upsert({
          orgId: 'org-1',
          userId: 'user-1',
          factoryProjectId: project.id,
          input: {
            board,
            externalSource: { integrationId: 'github', type: 'issue', externalId: `github-issue:${randomUUID()}` },
            title: 'Fix issue',
            stages: [stage],
            sessions: {},
            metadata: {},
          },
        });
      return { ...seed, scope, load, warn, card, work: () => seed.boards.get(scope, 'work') };
    }

    describe('auto-run', () => {
      it('leaves a project that had it off with the board it stored: runs outside an auto-start phase still wait for a person', async () => {
        const { load, work } = await setup({ auto_run_enabled: false }, [WORK]);
        const before = await work();

        const boards = await load();

        expect(await work()).toEqual(before);
        for (const phase of WORKING) expect(boards.get('work')!.startsAutomatically(phase, {}), phase).toBe(false);
      });

      it('starts every working phase on its own for a project that had it on, on every board it stored', async () => {
        const custom: StoredBoardInput = {
          key: 'docs',
          name: 'Docs',
          phases: [
            { key: 'inbox', name: 'Inbox', kind: 'resting', nextPhases: ['writing'] },
            {
              key: 'writing',
              name: 'Writing',
              kind: 'working',
              runner: { context: 'work' },
              // Auto-run started a run whatever the phase's own condition said.
              autoStart: true,
              autoStartWhen: {
                operator: 'AND',
                conditions: [{ field: 'item.labels', operator: 'contains', value: 'docs' }],
              },
              nextPhases: ['published'],
            },
            { key: 'published', name: 'Published', kind: 'terminal' },
          ],
        };
        const { load, work, boards: stored, scope } = await setup({ auto_run_enabled: true }, [WORK, custom]);

        const boards = await load();

        for (const phase of WORKING) expect(boards.get('work')!.startsAutomatically(phase, {}), phase).toBe(true);
        expect(boards.get('docs')!.startsAutomatically('writing', {})).toBe(true);
        expect((await work())!.revision).toBe(2);
        const writing = (await stored.get(scope, 'docs'))!.phases.find(phase => phase.key === 'writing')!;
        expect(writing).toMatchObject({ autoStart: true, autoStartWhen: null });
      });

      it('gives a project that had it on and stored no boards yet the seed with every working phase starting on its own', async () => {
        const { load, work } = await setup({ auto_run_enabled: true });

        const boards = await load();

        for (const phase of WORKING) expect(boards.get('work')!.startsAutomatically(phase, {}), phase).toBe(true);
        expect((await work())!.phases.filter(phase => phase.autoStart).map(phase => phase.key)).toEqual(WORKING);
      });

      it('runs once: a phase a person stopped starting on its own afterwards stays stopped', async () => {
        const { load, work, boards: stored, scope } = await setup({ auto_run_enabled: true }, [WORK]);
        const migrated = (await load()).get('work')!;
        const revision = (await work())!.revision;
        const { key: _key, ...row } = boardDefinitionOf(migrated);
        const edited = {
          ...row,
          phases: row.phases.map(phase => (phase.key === 'triage' ? { ...phase, autoStart: false } : phase)),
        };
        await stored.replace(scope, 'work', edited, { expectedRevision: revision, actor: 'user-1' });

        const boards = await load();

        expect(boards.get('work')!.startsAutomatically('triage', {})).toBe(false);
        expect((await work())!.revision).toBe(revision + 1);
      });
    });

    describe('self-review', () => {
      const OLDER_WORK = workSeedWithSelfReview();

      it("removes Work's self-review phase, and every move into it, for a project that had it off", async () => {
        const { load, work } = await setup({ self_review_enabled: false }, [OLDER_WORK]);

        const boards = await load();

        const row = (await work())!;
        expect(row.phases.map(phase => phase.key)).not.toContain('review');
        for (const phase of row.phases) expect(phase.nextPhases ?? [], phase.key).not.toContain('review');
        expect(boards.get('work')!.phases).not.toHaveProperty('review');
      });

      it('keeps the self-review phase for a project that had it on', async () => {
        const { load, work } = await setup({ self_review_enabled: true }, [OLDER_WORK]);
        const before = await work();

        const boards = await load();

        expect(await work()).toEqual(before);
        expect(boards.get('work')!.phases).toHaveProperty('review');
      });

      it('keeps a self-review phase cards sit in, and says why', async () => {
        const { load, work, card, warn } = await setup({ self_review_enabled: false }, [OLDER_WORK]);
        await card('review');
        const before = await work();

        await load();

        expect(await work()).toEqual(before);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('keeps its self-review phase "review"'));
        // It ran: a later load, after the cards moved on, leaves the board to the person.
        warn.mockClear();
        await load();
        expect(warn).not.toHaveBeenCalled();
      });

      /** A stored board of the project's own with a self-review phase, as a custom loop might have it. */
      const shipBoard = (buildMoves: string[]): StoredBoardInput => ({
        key: 'ship',
        name: 'Ship',
        phases: [
          { key: 'inbox', name: 'Inbox', kind: 'resting', nextPhases: ['build'] },
          { key: 'build', name: 'Build', kind: 'working', runner: { context: 'work' }, nextPhases: buildMoves },
          {
            key: 'check',
            name: 'Check',
            kind: 'working',
            runner: { skill: 'factory-self-review', context: 'review' },
            tools: ['factory_record_review_verdict'],
            nextPhases: ['build', 'pr'],
          },
          {
            key: 'pr',
            name: 'Pull request',
            kind: 'working',
            runner: { skill: 'factory-review', context: 'review' },
            tools: ['factory_review_source', 'factory_record_review_verdict'],
            nextPhases: ['build', 'shipped'],
          },
          { key: 'shipped', name: 'Shipped', kind: 'terminal' },
        ],
      });

      it('removes the self-review phase from every board the project stored, not only Work', async () => {
        const {
          load,
          boards: stored,
          scope,
        } = await setup({ self_review_enabled: false }, [OLDER_WORK, shipBoard(['check', 'pr'])]);

        const boards = await load();

        const ship = (await stored.get(scope, 'ship'))!;
        expect(ship.phases.map(phase => phase.key)).toEqual(['inbox', 'build', 'pr', 'shipped']);
        expect(ship.phases.find(phase => phase.key === 'build')!.nextPhases).toEqual(['pr']);
        expect(boards.get('ship')!.phases).not.toHaveProperty('check');
      });

      it("keeps a self-review phase an app board declares in code, and with it the board's code rules", async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const transitionPolicy = () => undefined;
        const { key: _key, ...ship } = shipBoard(['check', 'pr']);
        const app = defineBoard({
          id: 'ship',
          name: ship.name,
          initialPhase: 'inbox',
          transitionPolicy,
          phases: Object.fromEntries(ship.phases.map(({ key, ...phase }) => [key, phase])),
        } as Parameters<typeof defineBoard>[0]);
        const {
          load,
          boards: stored,
          scope,
          warn,
        } = await setup({ self_review_enabled: false }, [], createBoardRegistry({ boards: [app] }));

        const boards = await load();

        expect((await stored.get(scope, 'ship'))!.phases.map(phase => phase.key)).toContain('check');
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('keeps its self-review phase "check"'));
        expect(boards.get('ship')!.transitionPolicy).toBe(transitionPolicy);
      });

      it('keeps a self-review phase another phase could only move into, and says why', async () => {
        const ship = shipBoard(['check', 'pr']);
        const fasttrack: StoredBoardInput = {
          ...ship,
          phases: ship.phases.map(phase =>
            phase.key === 'inbox' ? { ...phase, nextPhases: ['build', 'check'] } : phase,
          ),
        };
        const stuck: StoredBoardInput = {
          ...ship,
          key: 'stuck',
          phases: [
            { key: 'triage', name: 'Triage', kind: 'resting', nextPhases: ['check'] },
            ...ship.phases.filter(phase => phase.key !== 'inbox'),
          ],
        };
        const { load, boards: stored, scope, warn } = await setup({ self_review_enabled: false }, [fasttrack, stuck]);
        const before = await stored.get(scope, 'stuck');

        await load();

        // A phase that keeps another move just loses this one.
        expect((await stored.get(scope, 'ship'))!.phases.find(phase => phase.key === 'inbox')!.nextPhases).toEqual([
          'build',
        ]);
        expect(await stored.get(scope, 'stuck')).toEqual(before);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('Board "stuck" keeps its self-review phase "check"'));
      });

      it("keeps a self-review phase the build phase can't get past without, and says why", async () => {
        const {
          load,
          boards: stored,
          scope,
          warn,
        } = await setup({ self_review_enabled: false }, [shipBoard(['check'])]);
        const before = await stored.get(scope, 'ship');

        await load();

        expect(await stored.get(scope, 'ship')).toEqual(before);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('keeps its self-review phase "check"'));
      });

      it("waits for a load that can read the project's cards before removing the phase", async () => {
        const { load, work, warn } = await setup({ self_review_enabled: false }, [OLDER_WORK]);
        const before = await work();

        await load({ cards: false });

        expect(await work()).toEqual(before);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("the project's cards can't be read yet"));

        await load();

        expect((await work())!.phases.map(phase => phase.key)).not.toContain('review');
      });

      it.skipIf(backend === 'libsql')(
        'reads which phases hold cards again when a concurrent write makes it retry',
        async () => {
          // LibSQL holds its single writer for the whole migration, so no card move lands in between.
          const {
            scope,
            card,
            work,
            workItems,
            boards: stored,
            projects,
            storage,
          } = await setup({ self_review_enabled: false }, [OLDER_WORK]);
          let reads = 0;
          const context = async (ops: FactoryStorageOps) => {
            const occupiedPhases = await occupiedPhasesOf(workItems)(scope, ops);
            if (reads++ === 0) {
              // Another replica moves a card into self-review and writes the boards after this read.
              await card('review');
              await storage.ops.updateMany(
                'factory_board_definition_versions',
                { org_id: scope.orgId, factory_project_id: scope.factoryProjectId },
                { version: randomUUID() },
              );
            }
            return {
              retiredSettings: await projects.retiredAutomationSettings(
                { orgId: scope.orgId, id: scope.factoryProjectId },
                ops,
              ),
              occupiedPhases,
              codePhases: () => undefined,
              warn: () => {},
            };
          };

          await stored.applyBoardMigrations(scope, BOARD_MIGRATIONS, context);

          expect(reads).toBe(2);
          expect((await work())!.phases.map(phase => phase.key)).toContain('review');
        },
      );

      it("seeds a project that stored no boards with today's Work, which has no self-review phase", async () => {
        const { load, work } = await setup({ self_review_enabled: true });

        await load();

        expect((await work())!.phases.map(phase => phase.key)).toEqual(WORK.phases.map(phase => phase.key));
      });
    });
  },
);
