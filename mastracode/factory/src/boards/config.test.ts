import { randomUUID } from 'node:crypto';

import { LibSQLFactoryStorage } from '@mastra/libsql';
import { PgFactoryStorage } from '@mastra/pg';
import { describe, expect, it, onTestFinished } from 'vitest';

import { BoardsStorage } from '../storage/domains/boards/base.js';
import type { ProjectBoardConfigInput } from '../storage/domains/boards/validation.js';
import { checkBoardConfigOption, createRunnerRegistry } from './config.js';
import { createBoardRegistry } from './registry.js';
import { BoardResolver } from './resolver.js';
import type { BoardRunner } from './runners.js';
import { defaultProjectBoardConfig } from './templates/work.js';

const postgresUrl = process.env.FACTORY_TEST_POSTGRES_URL;
const engines = ['libsql', ...(postgresUrl ? ['postgres'] : [])];

const opsCheck: BoardRunner = {
  id: 'ops-check',
  role: 'work',
  onEnter: { manual: () => ({ type: 'sendMessage', role: 'work', message: 'Check the alert.' }) },
};

const opsConfig: ProjectBoardConfigInput = {
  boards: [
    {
      key: 'ops',
      name: 'Ops',
      phases: [
        { key: 'open', name: 'Open', kind: 'resting' },
        { key: 'checking', name: 'Checking', kind: 'working', runner: { type: 'workflow', workflowId: 'ops-check' } },
        { key: 'closed', name: 'Closed', kind: 'terminal' },
      ],
    },
  ],
  intakeRoutes: [{ boardKey: 'ops' }],
};

describe('board config option', () => {
  it('adds app runners beside the built-in ones and refuses to shadow them', () => {
    const runners = createRunnerRegistry([opsCheck]);
    expect(runners.get('ops-check')).toBe(opsCheck);
    expect(runners.has('factory-triage')).toBe(true);
    expect(() => createRunnerRegistry([{ id: 'factory-plan' }])).toThrow(
      "MastraFactory: runner 'factory-plan' is built in; give yours another id.",
    );
    expect(() => createRunnerRegistry([opsCheck, opsCheck])).toThrow(
      "MastraFactory: duplicate runner id 'ops-check' in 'runners'.",
    );
  });

  it('fails at startup on an invalid config, an unknown runner or a key a code board uses', () => {
    const runners = createRunnerRegistry([opsCheck]);
    expect(checkBoardConfigOption(opsConfig, runners, new Set())).toBe(opsConfig);
    expect(checkBoardConfigOption(defaultProjectBoardConfig, runners, new Set())).toBe(defaultProjectBoardConfig);
    expect(() => checkBoardConfigOption(opsConfig, createRunnerRegistry(), new Set())).toThrow(
      "ops.checking: No runner is called 'ops-check'.",
    );
    expect(() => checkBoardConfigOption(opsConfig, runners, new Set(['ops']))).toThrow(
      "ops: A board in 'boards' already uses this id.",
    );
    const unknownAgent: ProjectBoardConfigInput = {
      boards: [
        {
          ...opsConfig.boards![0]!,
          phases: opsConfig.boards![0]!.phases.map(phase =>
            phase.key === 'checking'
              ? { ...phase, runner: { type: 'agent', agentId: 'not-an-agent', skill: 'ops-check' } }
              : phase,
          ),
        },
      ],
    };
    expect(() => checkBoardConfigOption(unknownAgent, runners, new Set())).toThrow(
      "ops.checking: No agent is called 'not-an-agent'; Factory's agents are 'code-agent'.",
    );
    const terminalFirst = {
      boards: [{ ...opsConfig.boards![0]!, phases: [{ key: 'x', name: 'X', kind: 'terminal' }] }],
    };
    expect(() => checkBoardConfigOption(terminalFirst as ProjectBoardConfigInput, runners, new Set())).toThrow(
      'The first phase cannot be terminal.',
    );
  });
});

describe.each(engines)('boards seeded from the config option (%s)', engine => {
  it('stores the app board for a new project and runs its phase with the app runner', async () => {
    const storage =
      engine === 'postgres'
        ? new PgFactoryStorage({ id: 'board-config-test', connectionString: postgresUrl! })
        : new LibSQLFactoryStorage({ id: 'board-config-test', url: ':memory:' });
    const boardDefinitions = storage.registerDomain(new BoardsStorage());
    await storage.init();
    onTestFinished(() => storage.close());
    const scope = { orgId: `org-${randomUUID()}`, factoryProjectId: randomUUID(), userId: 'user-1' };
    const resolver = new BoardResolver({
      codeBoards: createBoardRegistry({ includeDefaultBoards: false }),
      storage: boardDefinitions,
      runners: createRunnerRegistry([opsCheck]),
      recheckMs: 0,
    });

    expect(await boardDefinitions.seedDefaults({ ...scope, config: opsConfig })).toBe(true);
    const board = (await resolver.forProject(scope)).get('ops');
    expect(board?.phases.checking).toMatchObject({ kind: 'working', role: 'work' });
    expect(board?.rules.checking?.manual?.onEnter).toBe(opsCheck.onEnter!.manual);

    // A project that already stored boards keeps them.
    expect(await boardDefinitions.seedDefaults({ ...scope, config: defaultProjectBoardConfig })).toBe(false);
    expect((await boardDefinitions.getConfig(scope)).boards.map(stored => stored.key)).toEqual(['ops']);
  });
});
