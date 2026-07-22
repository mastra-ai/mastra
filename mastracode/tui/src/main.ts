#!/usr/bin/env node
/**
 * Main entry point for Mastra Code TUI.
 */
import fs from 'node:fs';

import { createMastraCode } from '@mastra/code-sdk';
import { createMastraCodeAnalytics } from '@mastra/code-sdk/analytics';
import { isStreamDestroyedError } from '@mastra/code-sdk/error-classification';
import { hasHeadlessFlag, runMCCli } from '@mastra/code-sdk/headless/index';
import { createBrowserFromSettings, loadSettings } from '@mastra/code-sdk/onboarding/settings';
import { formatScaffoldSuccess, scaffoldPlugin } from '@mastra/code-sdk/plugins/scaffold';
import { setupDebugLogging } from '@mastra/code-sdk/utils/debug-log';
import { drainPipedStdin, reopenStdinFromTTY } from '@mastra/code-sdk/utils/stdin-pipe';
import { releaseAllThreadLocks } from '@mastra/code-sdk/utils/thread-lock';
import { createTuiCleanup } from './main-cleanup.js';
import { detectTerminalTheme } from './tui/detect-theme.js';
import { MastraTUI } from './tui/index.js';
import { applyThemeMode, restoreTerminalForeground } from './tui/theme.js';
import { getCurrentVersion } from './version.js';

let controller: Awaited<ReturnType<typeof createMastraCode>>['controller'];
let mcpManager: Awaited<ReturnType<typeof createMastraCode>>['mcpManager'];
let hookManager: Awaited<ReturnType<typeof createMastraCode>>['hookManager'];
let authStorage: Awaited<ReturnType<typeof createMastraCode>>['authStorage'];
let signalsPubSub: Awaited<ReturnType<typeof createMastraCode>>['signalsPubSub'];
let githubSignals: Awaited<ReturnType<typeof createMastraCode>>['githubSignals'];
let storageMaintenance: Awaited<ReturnType<typeof createMastraCode>>['storageMaintenance'];
let analytics: ReturnType<typeof createMastraCodeAnalytics> | undefined;
let tui: MastraTUI | undefined;

function isTruthyEnv(name: string): boolean {
  return ['1', 'true', 'yes', 'on'].includes(process.env[name]?.trim().toLowerCase() ?? '');
}

function resolveInitialStateFromEnv() {
  const currentModelId = process.env.MASTRACODE_MODEL_ID?.trim();
  const initialState: Record<string, unknown> = {};
  if (currentModelId) initialState.currentModelId = currentModelId;
  if (isTruthyEnv('MASTRACODE_YOLO')) initialState.yolo = true;
  return Object.keys(initialState).length > 0 ? initialState : undefined;
}

// Global safety nets — catch any uncaught errors from storage init, etc.
process.on('uncaughtException', error => {
  // ERR_STREAM_DESTROYED is non-fatal — happens routinely when streams close
  // during shutdown, cancelled LLM requests, or LSP/subprocess exits (#13548, #13549)
  if (isStreamDestroyedError(error)) return;
  handleFatalError(error);
});
process.on('unhandledRejection', reason => {
  if (isStreamDestroyedError(reason)) return;
  handleFatalError(reason instanceof Error ? reason : new Error(String(reason)));
});

async function tuiMain(pipedInput?: string | null) {
  const settings = loadSettings();
  let browserPromise: ReturnType<typeof createBrowserFromSettings> | undefined;
  const loadBrowser = () => {
    browserPromise ??= createBrowserFromSettings(settings.browser);
    return browserPromise;
  };

  const initialState = resolveInitialStateFromEnv();
  const result = await createMastraCode({
    unixSocketPubSub: !isTruthyEnv('MASTRACODE_DISABLE_UNIX_SOCKET_PUBSUB'),
    disableMcp: isTruthyEnv('MASTRACODE_DISABLE_MCP'),
    disableHooks: isTruthyEnv('MASTRACODE_DISABLE_HOOKS'),
    ...(isTruthyEnv('MASTRACODE_DISABLE_MEMORY') ? { memory: false as never } : {}),
    ...(initialState ? { initialState: initialState as never } : {}),
  });
  controller = result.controller;
  mcpManager = result.mcpManager;
  hookManager = result.hookManager;
  authStorage = result.authStorage;
  signalsPubSub = result.signalsPubSub;
  githubSignals = result.githubSignals;
  storageMaintenance = result.storageMaintenance;

  if (result.storageWarning) {
    console.info(`⚠ ${result.storageWarning}`);
  }
  if (result.observabilityWarning) {
    console.info(`⚠ ${result.observabilityWarning}`);
  }

  // MCP connection is deferred to TUI.init() (after ui.start()) so that
  // status messages use showInfo() instead of console.info(), which would
  // corrupt the terminal.  Headless mode still inits from headless/cli.ts.

  setupDebugLogging();

  // Detect and apply terminal theme
  // MASTRA_THEME env var is the highest-priority override
  const envTheme = process.env.MASTRA_THEME?.toLowerCase();
  let themeMode: 'dark' | 'light';
  let detectedBgHex: string | undefined;
  if (envTheme === 'dark' || envTheme === 'light') {
    themeMode = envTheme;
  } else {
    const settings = loadSettings();
    const themePref = settings.preferences.theme;
    if (themePref === 'dark' || themePref === 'light') {
      themeMode = themePref;
    } else {
      const detection = await detectTerminalTheme();
      themeMode = detection.mode;
      detectedBgHex = detection.detectedBgHex;
    }
  }
  applyThemeMode(themeMode, detectedBgHex);

  // createMastraCode() brought up shared resources and minted the single
  // session that all work runs through. The AgentController owns no session of its own.
  const session = result.session;

  analytics = createMastraCodeAnalytics({ version: getCurrentVersion() });
  analytics.capture('mastracode_session_started', {
    mode: session.mode.get(),
    resourceId: session.identity.getResourceId(),
    hasAuthStorage: Boolean(authStorage),
    hasMcp: Boolean(mcpManager),
    theme: themeMode,
  });

  tui = new MastraTUI({
    controller: controller,
    session,
    hookManager,
    analytics,
    authStorage,
    mcpManager,
    pluginManager: result.pluginManager,
    storageMaintenance: result.storageMaintenance,
    appName: 'Mastra Code',
    version: getCurrentVersion(),
    inlineQuestions: true,
    githubSignals: result.githubSignals,
    ...(pipedInput ? { initialMessage: `The following was piped via stdin:\n\n${pipedInput}` } : {}),
  });
  const tuiRun = tui.run();

  if (settings.browser.enabled) {
    void loadBrowser()
      .then(browser => {
        if (!browser) return;
        controller.setBrowser(browser);
        void session.state.set({ activeBrowserSettings: settings.browser } as any).catch(() => {});
      })
      .catch(() => {});
  }

  await tuiRun;
  await asyncCleanup();
}

export const asyncCleanup = createTuiCleanup({
  stopWork: [
    () => mcpManager?.disconnect(),
    () => controller?.getMastra()?.stopWorkers(),
    () => controller?.stopIntervals(),
    () => githubSignals?.stopAllPolling(),
    () => (signalsPubSub as { close?: () => Promise<void> | void } | undefined)?.close?.(),
  ],
  closeStorage: () => storageMaintenance?.closeStorage?.(),
  shutdownAnalytics: () => analytics?.shutdown(),
  releaseLocks: releaseAllThreadLocks,
});

process.on('beforeExit', () => {
  void asyncCleanup().catch(error => {
    process.stderr.write(`Storage cleanup failed: ${error instanceof Error ? error.message : String(error)}\n`);
  });
});
process.on('exit', () => {
  // Ensure terminal protocols (kitty keyboard, modifyOtherKeys, bracketed paste,
  // raw mode) are disabled on ANY exit path. Without this, killing the process
  // via SIGINT/SIGTERM leaves the terminal in a corrupted state where keypresses
  // produce escape sequences like "5;99~" instead of normal characters.
  try {
    tui?.stop();
  } catch {
    // Failsafe: even if MastraTUI.stop() throws, write raw terminal reset
    // sequences to disable Kitty keyboard protocol, bracketed paste, and
    // modifyOtherKeys. These are the exact sequences pi-tui's terminal.stop()
    // would write.
  }
  // Belt-and-suspenders: always write terminal reset sequences directly,
  // regardless of whether tui.stop() succeeded. Writing them twice is harmless
  // but missing them leaves the terminal in a corrupted state.
  try {
    process.stdout.write(
      '\x1b[?2004l' + // disable bracketed paste
        '\x1b[<u' + // pop kitty keyboard protocol
        '\x1b[>4;0m' + // disable modifyOtherKeys
        '\x1b[?25h', // show cursor
    );
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(false);
    }
  } catch {
    // stdout may already be closed during exit
  }
  restoreTerminalForeground();
  releaseAllThreadLocks();
});

// For all termination signals: stop the TUI FIRST (synchronous, disables keyboard
// protocol immediately) before doing any async cleanup. This ensures the terminal
// escape sequences are written even if asyncCleanup hangs or the process is killed
// during cleanup.
const handleTermSignal = () => {
  try {
    tui?.stop();
  } catch {
    // ignored — exit handler has failsafe reset
  }
  void asyncCleanup().then(
    () => process.exit(0),
    error => {
      process.stderr.write(`Storage cleanup failed: ${error instanceof Error ? error.message : String(error)}\n`);
      process.exit(1);
    },
  );
};
process.on('SIGINT', handleTermSignal);
process.on('SIGTERM', handleTermSignal);
process.on('SIGHUP', handleTermSignal);

function hasEconnrefused(err: unknown, depth = 0): boolean {
  if (!err || depth > 5) return false;
  const e = err as any;
  if (e.code === 'ECONNREFUSED') return true;
  if (e.cause) return hasEconnrefused(e.cause, depth + 1);
  // AggregateError has .errors array
  if (Array.isArray(e.errors)) return e.errors.some((inner: unknown) => hasEconnrefused(inner, depth + 1));
  return false;
}

function pluginMain(args: string[]): void {
  if (args[0] !== 'scaffold') {
    process.stderr.write('Usage: mastracode plugin scaffold <dir> [--id acme.foo] [--name "Foo Tools"]\n');
    process.exit(1);
  }

  const dir = args[1];
  if (!dir) {
    process.stderr.write('Usage: mastracode plugin scaffold <dir> [--id acme.foo] [--name "Foo Tools"]\n');
    process.exit(1);
  }

  const id = readFlag(args, '--id');
  const name = readFlag(args, '--name');
  const targetDir = scaffoldPlugin(dir, { ...(id ? { id } : {}), ...(name ? { name } : {}) });
  process.stdout.write(`${formatScaffoldSuccess(targetDir)}\n`);
}

function readFlag(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

function handleFatalError(error: unknown): void {
  // Always write to real stderr, even if console.error was overridden
  const write = (msg: string) => process.stderr.write(msg + '\n');

  if (hasEconnrefused(error)) {
    const settings = loadSettings();
    const connStr = settings.storage?.pg?.connectionString;
    const target = connStr ?? 'localhost:5432';
    write(
      `\nFailed to connect to PostgreSQL at ${target}.` +
        `\nMake sure the database is running and accessible.` +
        `\n\nTo switch back to LibSQL:` +
        `\n  Set MASTRA_STORAGE_BACKEND=libsql or change the backend in /settings\n`,
    );
    void asyncCleanup()
      .catch(cleanupError => {
        write(`Storage cleanup failed: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`);
      })
      .finally(() => process.exit(1));
    return;
  }

  const msg = `Fatal error: ${error instanceof Error ? error.message : String(error)}`;
  write(msg);
  // Write crash log to file so it persists even if terminal closes
  try {
    const crashLog = `[${new Date().toISOString()}] ${msg}\n${error instanceof Error && error.stack ? error.stack + '\n' : ''}`;
    fs.appendFileSync('/tmp/mastra-crash.log', crashLog);
  } catch {}
  if (error instanceof Error && error.stack) {
    write(error.stack);
  }
  void asyncCleanup()
    .catch(cleanupError => {
      write(`Storage cleanup failed: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`);
    })
    .finally(() => process.exit(1));
}

async function main() {
  if (process.argv[2] === 'plugin') {
    return pluginMain(process.argv.slice(3));
  }

  if (hasHeadlessFlag(process.argv) || process.argv.includes('--help') || process.argv.includes('-h')) {
    return runMCCli();
  }

  if (process.argv.includes('--acp')) {
    const { acpMain } = await import('@mastra/code-sdk/acp/index');
    return acpMain({ dangerousAutoApprove: process.argv.includes('--dangerous-auto-approve') });
  }

  // When stdin is piped (e.g. `cat foo | mastracode`), drain the pipe fully
  // before starting the TUI.  The drain blocks until the sender process exits
  // and closes its stdout, so we never see partial output.
  let pipedInput: string | null = null;
  if (!process.stdin.isTTY) {
    process.stderr.write('Reading piped input...\n');
    pipedInput = await drainPipedStdin();

    // Always reopen a real TTY — even if the pipe was empty, the original
    // stdin is consumed/closed and the TUI needs a live TTY for keyboard input.
    const reopenedStdin = reopenStdinFromTTY();
    if (!reopenedStdin) {
      process.stderr.write('No TTY available — falling back to headless mode.\n');
      return runMCCli(pipedInput);
    }
  }

  return tuiMain(pipedInput);
}

main().catch(error => {
  handleFatalError(error);
});
