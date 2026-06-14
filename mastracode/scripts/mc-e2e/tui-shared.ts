import { appendFileSync } from 'node:fs';
import { test } from '@microsoft/tui-test';
import { getScenario } from './scenarios/index.js';
import type { McE2eScenarioRuntime, ScenarioName } from './scenarios/index.js';

type RunConfig = {
  scenarioName: ScenarioName;
  rows: number;
  columns: number;
  liveOutput: boolean;
  programFile: string;
  programArgs: string[];
  env: Record<string, string | null>;
};

function readEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

const runConfigs = JSON.parse(readEnv('MC_E2E_RUNS_JSON')) as RunConfig[];

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

function startLiveOutput(liveOutput: boolean, terminal: unknown) {
  if (!liveOutput) return;
  const pty = (terminal as { _pty?: { onData?: (callback: (data: string) => void) => void } })._pty;
  if (!pty?.onData) throw new Error('tui-test Terminal._pty.onData is unavailable; live observe mode needs updating.');
  const ttyPath = process.platform === 'win32' ? 'CONOUT$' : '/dev/tty';
  pty.onData(data => {
    try {
      appendFileSync(ttyPath, data);
    } catch {
      process.stdout.write(data);
    }
  });
}

function printScreen(liveOutput: boolean, label: string, terminal: { serialize(): { view: string } }) {
  if (liveOutput) return;
  process.stdout.write(
    '\n\n==================== ' +
      label +
      ' ====================\n' +
      terminal.serialize().view +
      '\n========================================================\n',
  );
}

async function waitForScreenText(pattern: RegExp, terminal: { serialize(): { view: string } }, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (pattern.test(terminal.serialize().view)) return;
    await sleep(100);
  }
  throw new Error('Timed out waiting for ' + pattern + '\n\n' + terminal.serialize().view);
}

async function waitForScreenTextAbsent(pattern: RegExp, terminal: { serialize(): { view: string } }, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!pattern.test(terminal.serialize().view)) return;
    await sleep(100);
  }
  throw new Error('Timed out waiting for ' + pattern + ' to disappear\n\n' + terminal.serialize().view);
}

export function defineScenarioTests(shardIndex: number, shardCount: number) {
  for (let index = 0; index < runConfigs.length; index += 1) {
    if (index % shardCount !== shardIndex) continue;
    const runConfig = runConfigs[index]!;
    const scenario = getScenario(runConfig.scenarioName);
    const runtime: McE2eScenarioRuntime = {
      printScreen: (label, terminal) => printScreen(runConfig.liveOutput, label, terminal),
      sleep,
      startLiveOutput: terminal => startLiveOutput(runConfig.liveOutput, terminal),
      waitForScreenText,
      waitForScreenTextAbsent,
    };

    test.describe(scenario.name, () => {
      test.use({
        rows: runConfig.rows,
        columns: runConfig.columns,
        env: {
          ...process.env,
          ...Object.fromEntries(
            Object.entries(runConfig.env).map(([key, value]) => [key, value === null ? undefined : value]),
          ),
        },
        program: {
          file: runConfig.programFile,
          args: runConfig.programArgs,
        },
      });

      test(scenario.testName, async ({ terminal }) => {
        await scenario.run({ terminal, runtime });
      });
    });
  }
}
