import { StdinBuffer } from '@earendil-works/pi-tui';
import type { Terminal } from '@earendil-works/pi-tui';
import type { MastraCodeConfig } from '@mastra/code-sdk';
import type { Terminal as XtermTerminalType } from '@xterm/headless';
import xterm from '@xterm/headless';

import { getScenario } from './tui/index.js';
import type {
  McE2eInProcessApp,
  McE2ePrepareContext,
  McE2eScenario,
  McE2eScenarioRuntime,
  McE2eStartMastraCodeAppOptions,
  McE2eTerminal,
  ScenarioName,
} from './tui/types.js';

export type TerminalRunConfig = {
  scenarioName: ScenarioName;
  rows: number;
  columns: number;
  liveOutput: boolean;
  env: Record<string, string | null>;
  cwd: string;
  context: McE2ePrepareContext;
};

const XtermTerminal = xterm.Terminal;
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

function isTruthyEnv(name: string): boolean {
  return ['1', 'true', 'yes', 'on'].includes(process.env[name]?.trim().toLowerCase() ?? '');
}

function resolveInitialStateFromEnv(): MastraCodeConfig['initialState'] {
  const currentModelId = process.env.MASTRACODE_MODEL_ID?.trim();
  const initialState: MastraCodeConfig['initialState'] = {};
  if (currentModelId) initialState.currentModelId = currentModelId;
  if (process.env.HOME) initialState.homeDir = process.env.HOME;
  if (isTruthyEnv('MASTRACODE_YOLO')) initialState.yolo = true;
  return Object.keys(initialState).length > 0 ? initialState : undefined;
}

class EmulatedTerminal implements Terminal {
  private readonly xterm: XtermTerminalType;
  private inputHandler?: (data: string) => void;
  private inputQueue = Promise.resolve();
  private outputQueue = Promise.resolve();
  private resizeHandler?: () => void;
  private stdinBuffer?: StdinBuffer;
  private terminalColumns: number;
  private terminalRows: number;

  constructor(terminalColumns: number, terminalRows: number) {
    this.terminalColumns = terminalColumns;
    this.terminalRows = terminalRows;
    this.xterm = new XtermTerminal({
      cols: terminalColumns,
      rows: terminalRows,
      disableStdin: true,
      allowProposedApi: true,
    });
  }

  start(onInput: (data: string) => void, onResize: () => void): void {
    this.inputHandler = onInput;
    this.resizeHandler = onResize;
    this.stdinBuffer = new StdinBuffer({ timeout: 10 });
    this.stdinBuffer.on('data', sequence => {
      this.inputHandler?.(sequence);
    });
    this.stdinBuffer.on('paste', content => {
      this.inputHandler?.(`\x1b[200~${content}\x1b[201~`);
    });
    this.writeToXterm('\x1b[?2004h');
  }

  private writeToXterm(data: string): void {
    this.outputQueue = this.outputQueue
      .then(() => new Promise<void>(resolve => this.xterm.write(data, resolve)))
      .catch(() => undefined);
  }

  stop(): void {
    this.writeToXterm('\x1b[?2004l');
    this.stdinBuffer?.destroy();
    this.stdinBuffer = undefined;
    this.inputHandler = undefined;
    this.resizeHandler = undefined;
  }

  async drainInput(_maxMs?: number, _idleMs?: number): Promise<void> {}

  write(data: string): void {
    this.writeToXterm(data);
  }

  get columns(): number {
    return this.terminalColumns;
  }

  get rows(): number {
    return this.terminalRows;
  }

  get kittyProtocolActive(): boolean {
    return true;
  }

  moveBy(lines: number): void {
    if (lines > 0) this.writeToXterm(`\x1b[${lines}B`);
    else if (lines < 0) this.writeToXterm(`\x1b[${-lines}A`);
  }

  hideCursor(): void {
    this.writeToXterm('\x1b[?25l');
  }

  showCursor(): void {
    this.writeToXterm('\x1b[?25h');
  }

  clearLine(): void {
    this.writeToXterm('\x1b[K');
  }

  clearFromCursor(): void {
    this.writeToXterm('\x1b[J');
  }

  clearScreen(): void {
    this.writeToXterm('\x1b[2J\x1b[H');
  }

  setTitle(title: string): void {
    this.writeToXterm(`\x1b]0;${title}\x07`);
  }

  setProgress(_active: boolean): void {}

  sendInput(data: string): void {
    this.inputQueue = this.inputQueue
      .then(async () => {
        this.stdinBuffer?.process(data);
        await sleep(25);
      })
      .catch(() => undefined);
  }

  async flushInput(): Promise<void> {
    await this.inputQueue;
    const flushed = this.stdinBuffer?.flush() ?? [];
    for (const sequence of flushed) this.inputHandler?.(sequence);
    await this.outputQueue;
  }

  resize(columns: number, rows: number): void {
    this.terminalColumns = columns;
    this.terminalRows = rows;
    this.xterm.resize(columns, rows);
    this.resizeHandler?.();
  }

  serialize(): { view: string } {
    const lines: string[] = [];
    const buffer = this.xterm.buffer.active;
    for (let index = 0; index < this.xterm.rows; index += 1) {
      const line = buffer.getLine(buffer.viewportY + index);
      lines.push(line?.translateToString(true) ?? '');
    }
    return { view: lines.join('\n') };
  }

  serializeHistory(): { output: string } {
    const lines: string[] = [];
    const buffer = this.xterm.buffer.active;
    for (let index = 0; index < buffer.length; index += 1) {
      const line = buffer.getLine(index);
      lines.push(line?.translateToString(true) ?? '');
    }
    return { output: lines.join('\n') };
  }
}

function countMatches(text: string, pattern: string | RegExp): number {
  if (typeof pattern === 'string') return text.includes(pattern) ? 1 : 0;
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  return Array.from(text.matchAll(new RegExp(pattern.source, flags))).length;
}

function createScenarioTerminal(terminal: EmulatedTerminal): McE2eTerminal {
  return {
    getByText(text: string | RegExp, options?: { strict?: boolean }) {
      return {
        searchTerm() {
          return text;
        },
        async resolve(timeout: number) {
          const deadline = Date.now() + timeout;
          while (Date.now() < deadline) {
            await terminal.flushInput();
            const matches = countMatches(terminal.serialize().view, text);
            if (matches > 0) {
              if (options?.strict !== false && matches > 1)
                throw new Error(`strict mode violation: ${matches} matches`);
              return { text };
            }
            await sleep(100);
          }
          return null;
        },
      };
    },
    async flushInput() {
      await terminal.flushInput();
    },
    keyCtrlC() {
      terminal.sendInput('\x03');
    },
    resize(columns: number, rows: number) {
      terminal.resize(columns, rows);
    },
    serialize() {
      return terminal.serialize();
    },
    serializeHistory() {
      return terminal.serializeHistory();
    },
    submit(text: string) {
      terminal.sendInput(`${text}\r`);
    },
    write(text: string) {
      terminal.sendInput(text);
    },
  };
}

async function waitForScreenText(pattern: RegExp, terminal: McE2eTerminal, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  const emulatedTerminal = (terminal as { flushInput?: () => Promise<void> }).flushInput;
  while (Date.now() < deadline) {
    await emulatedTerminal?.();
    if (pattern.test(terminal.serialize().view)) return;
    await sleep(100);
  }
  await emulatedTerminal?.();
  if (pattern.test(terminal.serialize().view)) return;
  throw new Error('Timed out waiting for ' + pattern + '\n\n' + terminal.serialize().view);
}

async function waitForScreenTextAbsent(pattern: RegExp, terminal: McE2eTerminal, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  const emulatedTerminal = (terminal as { flushInput?: () => Promise<void> }).flushInput;
  while (Date.now() < deadline) {
    await emulatedTerminal?.();
    if (!pattern.test(terminal.serialize().view)) return;
    await sleep(100);
  }
  await emulatedTerminal?.();
  if (!pattern.test(terminal.serialize().view)) return;
  throw new Error('Timed out waiting for ' + pattern + ' to disappear\n\n' + terminal.serialize().view);
}

async function waitForOutputText(pattern: RegExp, terminal: McE2eTerminal, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  const emulatedTerminal = (terminal as { flushInput?: () => Promise<void> }).flushInput;
  const getOutput = () => terminal.serializeHistory?.().output ?? terminal.serialize().view;
  while (Date.now() < deadline) {
    await emulatedTerminal?.();
    if (pattern.test(getOutput())) return;
    await sleep(100);
  }
  await emulatedTerminal?.();
  const output = getOutput();
  if (pattern.test(output)) return;
  throw new Error('Timed out waiting for ' + pattern + '\n\n' + output);
}

function writeConsoleLineToTerminal(terminal: Terminal, values: unknown[]): void {
  const text = values.map(value => (typeof value === 'string' ? value : String(value))).join(' ');
  terminal.write(`${text}\r\n`);
}

async function withTerminalProcessOutput<T>(terminal: Terminal, run: () => Promise<T>): Promise<T> {
  const runtimeConsole = globalThis['console'];
  const previousConsoleInfo = runtimeConsole.info;
  const previousConsoleLog = runtimeConsole.log;
  const previousExit = process.exit;
  runtimeConsole.info = (...values: unknown[]) => writeConsoleLineToTerminal(terminal, values);
  runtimeConsole.log = (...values: unknown[]) => writeConsoleLineToTerminal(terminal, values);
  process.exit = ((code?: string | number | null | undefined) => {
    if (code !== undefined && code !== null && code !== 0 && code !== '0') {
      throw new Error(`process.exit(${String(code)}) called during terminal backend run`);
    }
    return undefined;
  }) as unknown as typeof process.exit;
  try {
    return await run();
  } finally {
    runtimeConsole.info = previousConsoleInfo;
    runtimeConsole.log = previousConsoleLog;
    process.exit = previousExit;
  }
}

function withRunEnvironment<T>(runConfig: TerminalRunConfig, run: () => Promise<T>): Promise<T> {
  const previousCwd = process.cwd();
  const previousProcessCwd = process.cwd;
  const previousEnv = new Map<string, string | undefined>();
  for (const key of Object.keys(runConfig.env)) {
    previousEnv.set(key, process.env[key]);
    const value = runConfig.env[key];
    if (value === null) delete process.env[key];
    else process.env[key] = value;
  }

  let usedVirtualCwd = false;
  try {
    process.chdir(runConfig.cwd);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ERR_WORKER_UNSUPPORTED_OPERATION') throw error;
    usedVirtualCwd = true;
    process.cwd = () => runConfig.cwd;
  }

  return run().finally(() => {
    if (usedVirtualCwd) process.cwd = previousProcessCwd;
    else process.chdir(previousCwd);
    for (const [key, value] of previousEnv.entries()) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

async function startMastraCodeApp(
  runConfig: TerminalRunConfig,
  terminal: Terminal,
  options?: McE2eStartMastraCodeAppOptions,
): Promise<McE2eInProcessApp> {
  const [{ createMastraCode }, { MastraTUI }, { createBrowserFromSettings, loadSettings }] = await Promise.all([
    import('@mastra/code-sdk'),
    import('../src/tui/index.js'),
    import('@mastra/code-sdk/onboarding/settings'),
  ]);
  if (options?.setupDebugLogging) {
    const { setupDebugLogging } = await import('@mastra/code-sdk/utils/debug-log');
    setupDebugLogging();
  }
  const warn = globalThis.console.warn;
  for (const warning of options?.startupWarnings ?? []) warn(warning);
  const settings = loadSettings();
  const envInitialState = resolveInitialStateFromEnv();
  const configuredInitialState = options?.config?.initialState;
  const initialState: MastraCodeConfig['initialState'] =
    envInitialState || configuredInitialState
      ? { ...(envInitialState ?? {}), ...(configuredInitialState ?? {}) }
      : undefined;
  const result = await createMastraCode({
    unixSocketPubSub: !isTruthyEnv('MASTRACODE_DISABLE_UNIX_SOCKET_PUBSUB'),
    disableMcp: isTruthyEnv('MASTRACODE_DISABLE_MCP'),
    disableHooks: isTruthyEnv('MASTRACODE_DISABLE_HOOKS'),
    ...(isTruthyEnv('MASTRACODE_DISABLE_MEMORY') ? { memory: false } : {}),
    cwd: runConfig.cwd,
    ...(process.env.HOME ? { homeDir: process.env.HOME } : {}),
    ...(options?.config ?? {}),
    ...(initialState ? { initialState } : {}),
  });

  if (result.storageWarning) terminal.write(`⚠ ${result.storageWarning}\r\n`);
  if (result.observabilityWarning) terminal.write(`⚠ ${result.observabilityWarning}\r\n`);
  await options?.onCreated?.(result);

  const tui = new MastraTUI({
    controller: result.controller,
    session: result.session,
    hookManager: result.hookManager,
    authStorage: result.authStorage,
    mcpManager: result.mcpManager,
    pluginManager: result.pluginManager,
    appName: 'Mastra Code',
    version: process.env.npm_package_version ?? 'mc-e2e-terminal',
    inlineQuestions: true,
    githubSignals: result.githubSignals,
    storageMaintenance: result.storageMaintenance,
    terminal,
    ...(options?.tui ?? {}),
  });
  await options?.onTuiCreated?.(tui);

  void tui.run().catch(error => {
    process.stderr.write(`[mc-e2e:terminal] TUI run failed: ${error instanceof Error ? error.stack : String(error)}\n`);
  });

  if (settings.browser.enabled) {
    const browser = await createBrowserFromSettings(settings.browser);
    if (browser) {
      result.controller.setBrowser(browser);
      await result.session.state.set({ activeBrowserSettings: settings.browser });
    }
  }

  return {
    async stop() {
      result.session.thread.detachFromCurrent();
      tui.stop();
      const closeSignalsPubSub = (result.signalsPubSub as { close?: () => Promise<void> | void } | undefined)?.close;
      await Promise.allSettled([
        result.mcpManager?.disconnect(),
        result.controller.getMastra()?.stopWorkers(),
        result.controller.stopIntervals(),
        result.githubSignals?.stopAllPolling(),
        closeSignalsPubSub?.(),
      ]);
    },
  };
}

export async function runTerminalBackend(runConfig: TerminalRunConfig): Promise<number> {
  if (runConfig.liveOutput) throw new Error('terminal backend only supports run mode');
  return runTerminalScenario(runConfig, getScenario(runConfig.scenarioName));
}

export async function runTerminalScenario(
  runConfig: TerminalRunConfig,
  scenario: Omit<McE2eScenario, 'name'> & { name: string },
): Promise<number> {
  if (scenario.entrypoint && !scenario.inProcessApp) {
    throw new Error(`Terminal backend does not yet support custom entrypoint scenarios: ${scenario.name}`);
  }

  const terminal = new EmulatedTerminal(runConfig.columns, runConfig.rows);
  const scenarioTerminal = createScenarioTerminal(terminal);
  const runtime: McE2eScenarioRuntime = {
    printScreen(label, terminal) {
      process.stdout.write(
        `\n\n==================== ${label} ====================\n${terminal.serialize().view}\n========================================================\n`,
      );
    },
    sleep,
    startLiveOutput() {},
    waitForOutputText,
    waitForScreenText,
    waitForScreenTextAbsent,
  };

  return withRunEnvironment(runConfig, async () => {
    const { releaseAllThreadLocks } = await import('@mastra/code-sdk/utils/thread-lock');
    let stopApp: (() => Promise<void> | void) | undefined;

    try {
      if (scenario.inProcessApp) {
        const app = await scenario.inProcessApp({
          ...runConfig.context,
          columns: runConfig.columns,
          cwd: runConfig.cwd,
          env: runConfig.env,
          rows: runConfig.rows,
          startMastraCodeApp: options => startMastraCodeApp(runConfig, terminal, options),
          terminal,
        });
        stopApp = app.stop;
      } else {
        const app = await startMastraCodeApp(runConfig, terminal);
        stopApp = app.stop;
      }

      await withTerminalProcessOutput(terminal, () => scenario.run({ terminal: scenarioTerminal, runtime }));
      return 0;
    } finally {
      await stopApp?.();
      releaseAllThreadLocks();
    }
  });
}
