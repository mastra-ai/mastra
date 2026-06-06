#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LibSQLStore } from '@mastra/libsql';
import { getScenario, listScenarios } from './mc-e2e/scenarios/index.js';
import type { McE2eScenario, ScenarioName } from './mc-e2e/scenarios/index.js';

type RunMode = 'observe' | 'run';

type Options = {
  all: boolean;
  mode: RunMode;
  rows: number;
  columns: number;
  scenario: ScenarioName;
  jobs: number;
  recordAiPath?: string;
};

type AimockHandle = {
  scenarioName: ScenarioName;
  stop: () => Promise<void>;
  requestCount: () => number;
};

type TuiRunConfig = {
  scenarioName: ScenarioName;
  rows: number;
  columns: number;
  liveOutput: boolean;
  programFile: string;
  programArgs: string[];
  env: Record<string, string | null>;
};

const scenarioNames = new Set(listScenarios().map(scenario => scenario.name));

function parseArgs(argv: string[]): Options {
  const options: Options = {
    all: false,
    mode: 'observe',
    rows: Number(process.stdout.rows ?? process.env.LINES ?? 36),
    columns: Number(process.stdout.columns ?? process.env.COLUMNS ?? 120),
    scenario: 'startup',
    jobs: 1,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg === '--') continue;
    const [name, inlineValue] = arg.split('=', 2);
    const readValue = () => inlineValue ?? argv[++index];

    if (name === '--mode') {
      const mode = readValue();
      if (mode !== 'observe' && mode !== 'run') throw new Error(`Unknown mode: ${mode}`);
      options.mode = mode;
    } else if (name === '--run') {
      options.mode = 'run';
    } else if (name === '--observe') {
      options.mode = 'observe';
    } else if (name === '--all' || name === '--default-all') {
      options.all = true;
    } else if (name === '--jobs') {
      options.jobs = Number(readValue());
    } else if (name === '--rows') {
      options.rows = Number(readValue());
    } else if (name === '--columns' || name === '--cols') {
      options.columns = Number(readValue());
    } else if (name === '--scenario') {
      const scenario = readValue() as ScenarioName;
      if (!scenarioNames.has(scenario)) throw new Error(`Unknown scenario: ${scenario}`);
      options.scenario = scenario;
      options.all = false;
    } else if (name === '--record-ai') {
      options.recordAiPath = readValue();
    } else if (!arg.startsWith('-')) {
      const scenario = arg as ScenarioName;
      if (!scenarioNames.has(scenario)) throw new Error(`Unknown scenario: ${scenario}`);
      options.scenario = scenario;
      options.all = false;
    } else if (name === '--list') {
      for (const scenario of listScenarios()) {
        process.stdout.write(`${scenario.name}\t${scenario.description}\n`);
      }
      process.exit(0);
    } else if (name === '--help' || name === '-h') {
      process.stdout.write(
        `Usage: pnpm --filter ./mastracode e2e:test [scenario] -- [options]\n\nOptions:\n  --mode <mode>        observe | run. Default: observe\n  --run                Shortcut for --mode run\n  --observe            Shortcut for --mode observe\n  --scenario <name>    ${Array.from(scenarioNames).join(' | ')}. Default: startup\n  --all                Run every registered scenario\n  --jobs <n>           Number of tui-test workers. Default: 1\n  --record-ai <dir>    Record unmatched AIMock OpenAI calls to this fixture directory\n  --list               List available scenarios\n  --rows <n>           PTY rows. Default: current terminal rows or 36\n  --columns <n>        PTY columns. Default: current terminal columns or 120\n`,
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!Number.isInteger(options.rows) || options.rows < 10) throw new Error('--rows must be an integer >= 10');
  if (!Number.isInteger(options.columns) || options.columns < 40) throw new Error('--columns must be an integer >= 40');
  if (!Number.isInteger(options.jobs) || options.jobs < 1) throw new Error('--jobs must be an integer >= 1');

  if (options.mode === 'observe' && options.jobs > 1) {
    process.stdout.write('[mc-e2e] observe mode forces --jobs 1 so live terminal output stays readable.\n');
    options.jobs = 1;
  }

  return options;
}

function run(command: string, args: string[], cwd: string): void {
  const result = spawnSync(command, args, { cwd, stdio: 'pipe', encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(
      `Command failed: ${command} ${args.join(' ')}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
  }
}

function sh(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

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
                  fast: 'openai/gpt-5.4-mini',
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
  const storage = new LibSQLStore({ id: 'mc-e2e', url: `file:${dbPath}` });
  await storage.init();
  await storage.close();
}

async function startAimock({
  fixturePath,
  recordAiPath,
}: {
  fixturePath?: string;
  recordAiPath?: string;
}): Promise<{ url: string; stop: () => Promise<void>; requestCount: () => number }> {
  const { LLMock } = await import('@copilotkit/aimock');
  const mock = new LLMock({ port: 0 });

  if (recordAiPath) {
    if (!process.env.OPENAI_API_KEY) throw new Error('--record-ai requires OPENAI_API_KEY in the parent environment');
    mock.enableRecording({ providers: { openai: 'https://api.openai.com' }, fixturePath: recordAiPath });
  } else if (fixturePath) {
    mock.loadFixtureFile(fixturePath);
  }

  await mock.start();
  return {
    url: mock.url,
    stop: () => mock.stop(),
    requestCount: () => mock.getRequests().length,
  };
}

function createLongBranchProject(projectDir: string): { branch: string; abbreviatedBranch: string } {
  const branch = 'feature/super-long-branch-name-for-status-footer-e2e-regression-shield-extra-long';
  mkdirSync(projectDir, { recursive: true });
  run('git', ['init', '-b', 'main'], projectDir);
  run('git', ['config', 'user.email', 'mc-e2e@example.com'], projectDir);
  run('git', ['config', 'user.name', 'MC E2E'], projectDir);
  writeFileSync(join(projectDir, 'README.md'), '# mc e2e fixture\n');
  run('git', ['add', 'README.md'], projectDir);
  run('git', ['commit', '-m', 'init'], projectDir);
  run('git', ['checkout', '-b', branch], projectDir);
  return {
    branch,
    abbreviatedBranch: branch.slice(0, 12) + '..' + branch.slice(-8),
  };
}

async function prepareScenarioRun({
  scenario,
  options,
  fixturesDir,
  mainFile,
  mastracodeDir,
  runRoot,
  tsxBin,
}: {
  scenario: McE2eScenario;
  options: Options;
  fixturesDir: string;
  mainFile: string;
  mastracodeDir: string;
  runRoot: string;
  tsxBin: string;
}): Promise<{ aimock?: AimockHandle; branch?: string; config: TuiRunConfig }> {
  const isolatedHome = join(runRoot, 'home');
  const isolatedAppDataDir = getAppDataDirForHome(isolatedHome);
  const projectDir = join(runRoot, 'project');
  const dbPath = join(runRoot, 'mastra.db');
  const observabilityDbPath = join(runRoot, 'observability.db');
  mkdirSync(isolatedHome, { recursive: true });

  const recordAiPath = options.recordAiPath
    ? options.all
      ? join(resolve(options.recordAiPath), scenario.name)
      : resolve(options.recordAiPath)
    : undefined;
  const aimock = scenario.useOpenAIModel
    ? await startAimock({
        fixturePath: scenario.aimockFixture ? join(fixturesDir, scenario.aimockFixture) : undefined,
        recordAiPath,
      })
    : null;
  const aimockBaseUrl = aimock ? `${aimock.url.replace(/\/+$/, '')}/v1` : null;
  const openAiApiKey = options.recordAiPath ? process.env.OPENAI_API_KEY! : 'mc-e2e-openai-key';

  seedSettings(isolatedHome, scenario.useOpenAIModel === true, openAiApiKey);
  await initializeStorage(dbPath);

  const branchFixture = scenario.projectFixture === 'long-branch' ? createLongBranchProject(projectDir) : null;
  const launchCwd = branchFixture ? projectDir : mastracodeDir;
  const usesShellLaunch = launchCwd !== mastracodeDir;
  const programFile = usesShellLaunch ? '/bin/sh' : tsxBin;
  const programArgs = usesShellLaunch
    ? ['-lc', `cd ${sh(launchCwd)} && exec ${sh(tsxBin)} ${sh(mainFile)}`]
    : [mainFile];

  return {
    ...(aimock
      ? {
          aimock: {
            scenarioName: scenario.name,
            stop: () => aimock.stop(),
            requestCount: () => aimock.requestCount(),
          },
        }
      : {}),
    ...(branchFixture ? { branch: branchFixture.branch } : {}),
    config: {
      scenarioName: scenario.name,
      rows: options.rows,
      columns: options.columns,
      liveOutput: options.mode === 'observe',
      programFile,
      programArgs,
      env: {
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
        MASTRACODE_DISABLE_MEMORY: '1',
        ...(scenario.useOpenAIModel ? { MASTRACODE_MODEL_ID: 'openai/gpt-5.4-mini', MASTRACODE_YOLO: '1' } : {}),
        FORCE_COLOR: '1',
        TERM: 'xterm-256color',
        LINES: String(options.rows),
        COLUMNS: String(options.columns),
      },
    },
  };
}

const options = parseArgs(process.argv.slice(2));
const selectedScenarios = options.all ? listScenarios() : [getScenario(options.scenario)];
const scriptDir = dirname(fileURLToPath(import.meta.url));
const mastracodeDir = resolve(scriptDir, '..');
const fixturesDir = join(scriptDir, 'mc-e2e', 'fixtures');
const tmpRootDir = join(mastracodeDir, '.tmp-mc-e2e');
const tmpDir = join(tmpRootDir, `${Date.now()}-${process.pid}`);
const tuiTestBin = join(mastracodeDir, 'node_modules', '.bin', 'tui-test');
const tsxBin = join(mastracodeDir, 'node_modules', '.bin', 'tsx');
const mainFile = join(mastracodeDir, 'src/main.ts');
const testFile = join(scriptDir, 'mc-e2e', 'tui.test.ts');

mkdirSync(tmpRootDir, { recursive: true });
rmSync(tmpDir, { recursive: true, force: true });
mkdirSync(tmpDir, { recursive: true });

const runs = [] as TuiRunConfig[];
const aimocks = [] as AimockHandle[];
for (const scenario of selectedScenarios) {
  const prepared = await prepareScenarioRun({
    scenario,
    options,
    fixturesDir,
    mainFile,
    mastracodeDir,
    runRoot: join(tmpDir, 'runs', scenario.name),
    tsxBin,
  });
  runs.push(prepared.config);
  if (prepared.aimock) aimocks.push(prepared.aimock);
  if (prepared.branch)
    process.stdout.write(`[mc-e2e] expecting startup branch context for ${scenario.name}: ${prepared.branch}\n`);
}

process.stdout.write(
  `[mc-e2e] running ${runs.map(run => run.scenarioName).join(', ')} under @microsoft/tui-test (${options.columns}x${options.rows}, mode=${options.mode}, jobs=${options.jobs})...\n`,
);
for (const run of runs) {
  if (run.env.OPENAI_BASE_URL) {
    process.stdout.write(`[mc-e2e] ${run.scenarioName} AIMock OpenAI base URL: ${run.env.OPENAI_BASE_URL}\n`);
  }
}
if (options.recordAiPath)
  process.stdout.write(`[mc-e2e] recording AIMock fixtures to: ${resolve(options.recordAiPath)}\n`);

const testProcess = spawn(tuiTestBin, [testFile], {
  cwd: mastracodeDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    MC_E2E_JOBS: String(options.jobs),
    MC_E2E_RUNS_JSON: JSON.stringify(runs),
  },
});
const status = await new Promise<number | null>((resolve, reject) => {
  testProcess.on('error', reject);
  testProcess.on('exit', resolve);
});

let missingRequest = false;
for (const aimock of aimocks) {
  const requestCount = aimock.requestCount();
  process.stdout.write(`[mc-e2e] ${aimock.scenarioName} AIMock request count: ${requestCount}\n`);
  await aimock.stop();
  if (status === 0 && requestCount === 0) missingRequest = true;
}

if (missingRequest) {
  process.stderr.write('[mc-e2e] expected at least one AIMock request for each OpenAI-backed scenario but saw none.\n');
  process.exit(1);
}

process.exit(status ?? 1);
