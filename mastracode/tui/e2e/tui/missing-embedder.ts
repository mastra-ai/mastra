import { readFileSync, writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { join } from 'node:path';
import { expect } from 'vitest';
import { installOpenAIFetchCapture } from './openai-fetch-capture.js';
import type { McE2ePrepareContext, McE2eInProcessApp, McE2eScenario } from './types.js';

// A user without @mastra/fastembed, who cannot install it (first-use installs turned off with
// MASTRACODE_FEATURE_INSTALL=never), runs a task long enough for Observational Memory to observe it, and the
// model then searches memory. Memory treats vector writes
// as best-effort and Mastra Code silences console.warn, so before the fix nothing told the user that recall
// was off: the headless run exited 0 with empty stderr and the TUI showed nothing.

export const MISSING_EMBEDDER_PROMPT = 'MC_MISSING_EMBEDDER_PROMPT search memory for the earlier setup notes';
const THRESHOLD_FILLER = ' missing embedder observation filler'.repeat(900);
const NOTICE = /Warning: Memory recall is off: local embeddings are not installed/;
/** The package was never installed, so the fix is the feature install, not reinstalling Mastra Code. */
const REMEDY = 'mastracode features install embeddings';
const NOTICE_TEXT = 'Memory recall is off';
const NOTICE_LINE = `Warning: ${NOTICE_TEXT}`;

/** Makes `@mastra/fastembed` unresolvable in this process, as if it were not installed. */
function blockFastembed(): () => void {
  const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === '@mastra/fastembed' || specifier.startsWith('@mastra/fastembed/')) {
        const error = new Error(`Cannot find package '@mastra/fastembed' imported from ${context.parentURL}`);
        (error as NodeJS.ErrnoException).code = 'ERR_MODULE_NOT_FOUND';
        throw error;
      }
      return nextResolve(specifier, context);
    },
  });
  return () => hooks.deregister();
}

function enableObservationAfterOneTurn({ appDataDir }: McE2ePrepareContext): void {
  const settingsPath = join(appDataDir, 'settings.json');
  const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as Record<string, unknown>;
  settings.onboarding = { completedAt: new Date(0).toISOString(), skippedAt: null, version: 1 };
  settings.models = {
    ...((settings.models ?? {}) as Record<string, unknown>),
    observerModelOverride: 'openai/gpt-5.4-mini',
    reflectorModelOverride: 'openai/gpt-5.4-mini',
    omObservationThreshold: 2100,
    omReflectionThreshold: 100_000,
  };
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

function countNotices(text: string): number {
  return text.split(NOTICE_LINE).length - 1;
}

/** The recall tool result the model received carries the same actionable message. */
function verifyRecallToolError(requests: unknown[]): void {
  const serialized = JSON.stringify(requests);
  expect(serialized).toContain('MC_MISSING_EMBEDDER_PROMPT');
  expect(serialized).toContain('## New Message History to Observe');
  expect(serialized).toContain(NOTICE_TEXT);
}

export const missingEmbedderTuiScenario = {
  name: 'missing-embedder-tui',
  description: 'Shows one warning in the TUI when the local embedder package cannot be loaded.',
  testName: 'warns once that memory recall is off when @mastra/fastembed is missing',
  enableObservationalMemory: true,
  useOpenAIModel: true,
  aimockFixture: 'missing-embedder.json',
  env: () => ({ MASTRACODE_DISABLE_MEMORY: '0', MASTRACODE_FEATURE_INSTALL: 'never' }),
  prepare: enableObservationAfterOneTurn,
  async inProcessApp({ startMastraCodeApp, mastracodeDir }) {
    const unblock = blockFastembed();
    const restoreFetch = installOpenAIFetchCapture({
      capturePath: join(mastracodeDir, '.tmp-mc-e2e', 'missing-embedder-tui-requests.jsonl'),
      append: true,
      inputTokens: 2600,
    });
    // The real TUI startup path silences console.warn, which is what hid the failure.
    const app = await startMastraCodeApp({ setupDebugLogging: true });
    return {
      stop: async () => {
        await app.stop?.();
        restoreFetch();
        unblock();
      },
    };
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Mastra Code|Project:/i, terminal);

    terminal.write(`${MISSING_EMBEDDER_PROMPT}${THRESHOLD_FILLER}`);
    terminal.submit('');
    await runtime.waitForScreenText(/MC missing embedder turn done/i, terminal, 45_000);
    await runtime.waitForScreenText(NOTICE, terminal, 45_000);
    await runtime.sleep(1_000);
    runtime.printScreen('missing embedder warning', terminal);

    const history = terminal.serializeHistory?.().output ?? terminal.serialize().view;
    expect(countNotices(history)).toBe(1);
    expect(history).toContain(REMEDY);
    expect(history).not.toContain('Reinstall Mastra Code');
    terminal.keyCtrlC();
  },
  verifyAimockRequests: verifyRecallToolError,
} satisfies McE2eScenario;

type HeadlessOutcome = { stdout: string; stderr: string; exitCode: number };

async function runHeadlessInProcess(
  terminal: { write: (text: string) => void },
  args: string[],
): Promise<HeadlessOutcome> {
  const previousArgv = process.argv;
  const previousStdoutWrite = process.stdout.write;
  const previousStderrWrite = process.stderr.write;
  const previousExit = process.exit;
  const outcome: HeadlessOutcome = { stdout: '', stderr: '', exitCode: -1 };

  const capture = (sink: 'stdout' | 'stderr') =>
    ((
      chunk: string | Uint8Array,
      encodingOrCallback?: BufferEncoding | ((error?: Error | null) => void),
      callback?: (error?: Error | null) => void,
    ) => {
      const text = typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk);
      outcome[sink] += text;
      if (sink === 'stderr') terminal.write(text.replace(/\n/g, '\r\n'));
      if (typeof encodingOrCallback === 'function') encodingOrCallback();
      else callback?.();
      return true;
    }) as typeof process.stdout.write;

  process.argv = [process.argv[0] ?? 'node', 'missing-embedder-e2e', ...args];
  process.stdout.write = capture('stdout');
  process.stderr.write = capture('stderr');
  process.exit = ((code?: string | number | null | undefined) => {
    throw new Error(`MC_E2E_HEADLESS_EXIT:${code ?? 0}`);
  }) as typeof process.exit;

  try {
    const { runMCCli } = await import('@mastra/code-sdk/headless/index');
    await runMCCli();
  } catch (error) {
    const match = error instanceof Error ? /^MC_E2E_HEADLESS_EXIT:(\d+)/.exec(error.message) : null;
    if (!match) throw error;
    outcome.exitCode = Number(match[1]);
  } finally {
    process.argv = previousArgv;
    process.stdout.write = previousStdoutWrite;
    process.stderr.write = previousStderrWrite;
    process.exit = previousExit;
  }
  return outcome;
}

export const missingEmbedderHeadlessScenario = {
  name: 'missing-embedder-headless',
  description: 'Writes one warning to stderr in headless mode when the local embedder package cannot be loaded.',
  testName: 'warns once on stderr that memory recall is off when @mastra/fastembed is missing',
  enableObservationalMemory: true,
  useOpenAIModel: true,
  aimockFixture: 'missing-embedder.json',
  env: () => ({ MASTRACODE_DISABLE_MEMORY: '0', MASTRACODE_FEATURE_INSTALL: 'never' }),
  prepare: enableObservationAfterOneTurn,
  async inProcessApp({ mastracodeDir }): Promise<McE2eInProcessApp> {
    const unblock = blockFastembed();
    const restoreFetch = installOpenAIFetchCapture({
      capturePath: join(mastracodeDir, '.tmp-mc-e2e', 'missing-embedder-headless-requests.jsonl'),
      append: true,
      inputTokens: 2600,
    });
    return {
      stop: () => {
        restoreFetch();
        unblock();
      },
    };
  },
  async run({ terminal }) {
    // Runs inside run() so this scenario's process.exit capture is the innermost one.
    const outcome = await runHeadlessInProcess(terminal, [
      '--prompt',
      `${MISSING_EMBEDDER_PROMPT}${THRESHOLD_FILLER}`,
      '--output',
      'jsonl',
      '--timeout',
      '60',
    ]);
    const lines = outcome.stdout.trim().split('\n');
    const result = JSON.parse(lines[lines.length - 1]!) as { type: string; status: string; text: string };

    // The task itself still completes, so the exit code stays 0; the warning is the signal.
    expect(result.type).toBe('result');
    expect(result.status).toBe('completed');
    expect(result.text).toContain('MC missing embedder turn done');
    expect(outcome.exitCode).toBe(0);
    expect(outcome.stderr).toMatch(NOTICE);
    expect(countNotices(outcome.stderr)).toBe(1);
    expect(outcome.stderr).toContain(REMEDY);
    expect(outcome.stderr).not.toContain('Reinstall Mastra Code');
    // stdout stays machine-readable: only JSONL lines.
    for (const line of lines) expect(() => JSON.parse(line)).not.toThrow();
  },
  verifyAimockRequests: verifyRecallToolError,
} satisfies McE2eScenario;
