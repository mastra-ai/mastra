import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LLMock } from '@copilotkit/aimock';
import { LibSQLStore } from '@mastra/libsql';
import { afterAll, describe, it } from 'vitest';

import type { TerminalRunConfig } from './terminal-backend.js';
import { runTerminalBackend } from './terminal-backend.js';
import type { McE2eScenario, ScenarioName } from './tui/index.js';
import { getScenario, listScenarios } from './tui/index.js';

const rows = Number(process.env.MC_E2E_ROWS ?? 36);
const columns = Number(process.env.MC_E2E_COLUMNS ?? 120);
const scriptDir = dirname(fileURLToPath(import.meta.url));
const mastracodeDir = resolve(scriptDir, '../..');
const fixturesDir = join(scriptDir, 'fixtures');
const tmpRootDir = join(mastracodeDir, '.tmp-mc-e2e-vitest');
// The in-process runner shares event infrastructure across scenarios. Keep each
// DELETE-journal database alive until the shard finishes so stale handles never
// observe a removed database while the next scenario starts.
const completedRunRoots = new Set<string>();
const defaultScenarioNames = [
  'startup',
  'automated-chat',
  'modal-and-shell',
] as const satisfies readonly ScenarioName[];

const includeSubprocessMarked = process.env.MC_E2E_VITEST_INCLUDE_SUBPROCESS_MARKED === '1';

function parseShardNumber(name: string, defaultValue: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return defaultValue;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer`);
  return value;
}

function applyShard(names: ScenarioName[], shardIndex: number, shardTotal: number): ScenarioName[] {
  if (shardTotal < 1) throw new Error('MC_E2E_VITEST_SHARD_TOTAL must be greater than zero');
  if (shardIndex >= shardTotal)
    throw new Error('MC_E2E_VITEST_SHARD_INDEX must be less than MC_E2E_VITEST_SHARD_TOTAL');
  if (shardTotal === 1) return names;
  return names.filter((_, index) => index % shardTotal === shardIndex);
}

function selectScenarioNames(shardIndex: number, shardTotal: number): ScenarioName[] {
  const raw = process.env.MC_E2E_VITEST_SCENARIOS?.trim();
  if (!raw) return applyShard([...defaultScenarioNames], shardIndex, shardTotal);
  if (raw === 'all') {
    return applyShard(
      listScenarios()
        .filter(
          scenario => (!scenario.entrypoint || scenario.inProcessApp) && scenario.terminalBackend !== 'subprocess',
        )
        .map(scenario => scenario.name),
      shardIndex,
      shardTotal,
    );
  }
  return applyShard(
    raw.split(',').map(name => getScenario(name.trim() as ScenarioName).name),
    shardIndex,
    shardTotal,
  );
}

type AimockHandle = {
  url: string;
  stop: () => Promise<void>;
  requestCount: () => number;
  requests: () => unknown[];
};

function getAppDataDirForHome(homeDir: string): string {
  if (process.platform === 'darwin') return join(homeDir, 'Library', 'Application Support', 'mastracode');
  if (process.platform === 'win32') return join(homeDir, 'AppData', 'Roaming', 'mastracode');
  return join(homeDir, '.local', 'share', 'mastracode');
}

function seedSettings(homeDir: string, useOpenAIModel: boolean, openAiApiKey = 'mc-e2e-openai-key'): void {
  const appDataDir = getAppDataDirForHome(homeDir);
  mkdirSync(appDataDir, { recursive: true });
  if (useOpenAIModel) {
    writeFileSync(
      join(appDataDir, 'auth.json'),
      JSON.stringify(
        {
          'apikey:openai-codex': { type: 'api_key', key: openAiApiKey },
        },
        null,
        2,
      ),
    );
  }
  writeFileSync(
    join(appDataDir, 'settings.json'),
    JSON.stringify(
      {
        onboarding: {
          skippedAt: '2026-01-01T00:00:00.000Z',
          version: 1,
          quietModePreferenceSelected: true,
        },
        ...(useOpenAIModel
          ? {
              models: {
                activeModelPackId: null,
                modeDefaults: {
                  build: 'openai/gpt-5.4-mini',
                  plan: 'openai/gpt-5.4-mini',
                },
              },
            }
          : {}),
      },
      null,
      2,
    ),
  );
}

async function initializeStorage(dbPath: string): Promise<void> {
  const storage = new LibSQLStore({ id: 'mc-e2e-vitest', url: `file:${dbPath}` });
  await storage.init();
  await storage.close();
}

async function startAimock({ fixturePath }: { fixturePath?: string }): Promise<AimockHandle> {
  const mock = new LLMock({ port: 0 });
  if (fixturePath) mock.loadFixtureFile(fixturePath);
  await mock.start();
  return {
    url: mock.url,
    stop: () => mock.stop(),
    requestCount: () => mock.getRequests().length,
    requests: () => mock.getRequests() as unknown[],
  };
}

function run(command: string, args: string[], cwd: string): void {
  const result = spawnSync(command, args, { cwd, stdio: 'pipe', encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(
      `Command failed: ${command} ${args.join(' ')}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
  }
}

function createBasicProject(projectDir: string): void {
  mkdirSync(projectDir, { recursive: true });
  writeFileSync(join(projectDir, 'README.md'), '# mc e2e fixture\n');
}

function createLongBranchProject(projectDir: string): void {
  const branch = 'feature/super-long-branch-name-for-status-footer-e2e-regression-shield-extra-long';
  createBasicProject(projectDir);
  run('git', ['init', '-b', 'main'], projectDir);
  run('git', ['config', 'user.email', 'mc-e2e@example.com'], projectDir);
  run('git', ['config', 'user.name', 'MC E2E'], projectDir);
  run('git', ['add', 'README.md'], projectDir);
  run('git', ['commit', '-m', 'init'], projectDir);
  run('git', ['checkout', '-b', branch], projectDir);
}

async function prepareTerminalRun(
  scenario: McE2eScenario,
  runRoot: string,
): Promise<{ aimock?: AimockHandle; config: TerminalRunConfig }> {
  const isolatedHome = join(runRoot, 'home');
  const isolatedAppDataDir = getAppDataDirForHome(isolatedHome);
  const projectDir = join(runRoot, scenario.projectFixture === 'long-branch' ? 'project' : 'mastra');
  const dbPath = join(runRoot, 'mastra.db');
  const observabilityDbPath = join(runRoot, 'observability.db');
  mkdirSync(isolatedHome, { recursive: true });

  const aimock = scenario.useOpenAIModel
    ? await startAimock({ fixturePath: scenario.aimockFixture ? join(fixturesDir, scenario.aimockFixture) : undefined })
    : undefined;
  const aimockBaseUrl = aimock ? `${aimock.url.replace(/\/+$/, '')}/v1` : null;
  const openAiApiKey = 'mc-e2e-openai-key';

  seedSettings(isolatedHome, scenario.useOpenAIModel === true, openAiApiKey);
  await initializeStorage(dbPath);
  if (scenario.projectFixture === 'long-branch') createLongBranchProject(projectDir);
  else if (scenario.projectFixture !== 'manual') createBasicProject(projectDir);

  const scenarioContext = {
    appDataDir: isolatedAppDataDir,
    dbPath,
    homeDir: isolatedHome,
    mastracodeDir,
    projectDir,
  };
  await scenario.prepare?.(scenarioContext);

  const launchCwd = projectDir;

  const env: Record<string, string | null> = {
    ...(aimockBaseUrl
      ? {
          OPENAI_API_KEY: openAiApiKey,
          OPENAI_BASE_URL: aimockBaseUrl,
          GOOGLE_GENERATIVE_AI_API_KEY: null,
          GOOGLE_API_KEY: null,
          ANTHROPIC_API_KEY: null,
          MASTRA_GATEWAY_API_KEY: null,
        }
      : {}),
    HOME: isolatedHome,
    MASTRA_APP_DATA_DIR: isolatedAppDataDir,
    MASTRA_DB_PATH: dbPath,
    MASTRA_OBSERVABILITY_DB_PATH: observabilityDbPath,
    MASTRA_USER_ID: 'mc-e2e',
    MASTRACODE_DISABLE_MCP: '1',
    MASTRACODE_DISABLE_HOOKS: '1',
    MASTRACODE_DISABLE_UNIX_SOCKET_PUBSUB: '1',
    ...(scenario.disableMemory === true ? { MASTRACODE_DISABLE_MEMORY: '1' } : {}),
    ...(scenario.name === 'update-startup-prompt' ? {} : { MASTRACODE_DISABLE_UPDATE_CHECK: '1' }),
    ...(scenario.useOpenAIModel ? { MASTRACODE_MODEL_ID: 'openai/gpt-5.4-mini', MASTRACODE_YOLO: '1' } : {}),
    FORCE_COLOR: '1',
    TERM: 'xterm-256color',
    LINES: String(rows),
    COLUMNS: String(columns),
    ...scenario.env?.(scenarioContext),
  };
  env.MC_E2E_RUNS_JSON = JSON.stringify([{ scenarioName: scenario.name, env }]);

  return {
    ...(aimock ? { aimock } : {}),
    config: {
      scenarioName: scenario.name,
      rows,
      columns,
      liveOutput: false,
      cwd: launchCwd,
      context: scenarioContext,
      env,
    },
  };
}

async function runScenarioInProcess(scenario: McE2eScenario): Promise<void> {
  if (
    (scenario.entrypoint && !scenario.inProcessApp) ||
    (scenario.terminalBackend === 'subprocess' && !includeSubprocessMarked)
  ) {
    throw new Error(`${scenario.name} is not supported by the in-process terminal backend`);
  }

  const runRoot = join(tmpRootDir, `${Date.now()}-${process.pid}`, scenario.name);
  const { aimock, config } = await prepareTerminalRun(scenario, runRoot);
  let passed = false;
  try {
    const status = await runTerminalBackend(config);
    if (status !== 0) throw new Error(`${scenario.name} exited with status ${status}`);
    if (aimock) {
      const requestCount = aimock.requestCount();
      if (requestCount === 0) throw new Error(`${scenario.name} expected at least one AIMock request but saw none`);
      scenario.verifyAimockRequests?.(aimock.requests());
    }
    passed = true;
  } finally {
    if (passed) completedRunRoots.add(runRoot);
    await aimock?.stop();
  }
}

export function defineTerminalBackendVitestTests(options: { shardIndex?: number; shardTotal?: number } = {}): void {
  const shardIndex = options.shardIndex ?? parseShardNumber('MC_E2E_VITEST_SHARD_INDEX', 0);
  const shardTotal = options.shardTotal ?? parseShardNumber('MC_E2E_VITEST_SHARD_TOTAL', 1);
  const scenarioNames = selectScenarioNames(shardIndex, shardTotal);

  afterAll(() => {
    for (const runRoot of completedRunRoots) {
      rmSync(runRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
    completedRunRoots.clear();
    try {
      if (readdirSync(tmpRootDir).length === 0) rmdirSync(tmpRootDir);
    } catch {
      // Other e2e runs may still be using or cleaning the temp root.
    }
  });

  describe.sequential(`mc-e2e terminal backend in Vitest (${shardIndex + 1}/${shardTotal})`, () => {
    if (scenarioNames.length === 0) {
      it.skip('has no scenarios assigned to this shard', () => undefined);
      return;
    }

    for (const scenarioName of scenarioNames) {
      const scenario = getScenario(scenarioName);
      const register = scenario.skipReason ? it.skip : it;
      register(
        scenario.skipReason ? `${scenario.testName} (${scenario.skipReason})` : scenario.testName,
        async () => {
          await runScenarioInProcess(scenario);
        },
        90_000,
      );
    }
  });
}
