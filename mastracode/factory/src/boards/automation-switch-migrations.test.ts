import { randomUUID } from 'node:crypto';

import { LibSQLFactoryStorage } from '@mastra/libsql';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import type { StoredBoardInput, StoredBoardScope } from '../storage/domains/boards/base.js';
import { createFactoryStorageForTests, createIsolatedFactoryPostgresForTests } from '../storage/test-utils.js';
import { occupiedPhasesOf, ProjectBoardCache } from './project-boards.js';
import { createBoardRegistry } from './registry.js';
import { boardDefinitionOf } from './stored-board.js';
import { workSeedWithSelfReview } from './work-migrations.js';
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
      /** A Factory process loading the project, wired as MastraFactory wires its board cache. */
      const load = () =>
        new ProjectBoardCache({
          codeRegistry: createBoardRegistry(),
          storage: seed.boards,
          projects: seed.projects,
          occupiedPhases: occupiedPhasesOf(seed.workItems),
          warn,
        }).load(scope);
      const card = (stage: string) =>
        seed.workItems.upsert({
          orgId: 'org-1',
          userId: 'user-1',
          factoryProjectId: project.id,
          input: {
            board: 'work',
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
              autoStartWhen: { all: [{ fact: 'item.labels', operator: 'contains', value: 'docs' }] },
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

      it("seeds a project that stored no boards with today's Work, which has no self-review phase", async () => {
        const { load, work } = await setup({ self_review_enabled: true });

        await load();

        expect((await work())!.phases.map(phase => phase.key)).toEqual(WORK.phases.map(phase => phase.key));
      });
    });
  },
);
