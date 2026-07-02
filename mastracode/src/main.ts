#!/usr/bin/env node
/**
 * Main entry point for Mastra Code TUI.
 */
import fs from 'node:fs';

import { createMastraCodeAnalytics } from './analytics.js';
import { isStreamDestroyedError } from './error-classification.js';
import { hasHeadlessFlag, runMCCli } from './headless/index.js';
import { createBrowserFromSettings, loadSettings } from './onboarding/settings.js';
import { formatScaffoldSuccess, scaffoldPlugin } from './plugins/scaffold.js';
import { detectTerminalTheme } from './tui/detect-theme.js';
import { MastraTUI } from './tui/index.js';
import { applyThemeMode, restoreTerminalForeground } from './tui/theme.js';
import { setupDebugLogging } from './utils/debug-log.js';
import { drainPipedStdin, reopenStdinFromTTY } from './utils/stdin-pipe.js';
import { releaseAllThreadLocks } from './utils/thread-lock.js';
import { getCurrentVersion } from './utils/update-check.js';
import { createMastraCode } from './index.js';

let controller: Awaited<ReturnType<typeof createMastraCode>>['controller'];
let mcpManager: Awaited<ReturnType<typeof createMastraCode>>['mcpManager'];
let hookManager: Awaited<ReturnType<typeof createMastraCode>>['hookManager'];
let authStorage: Awaited<ReturnType<typeof createMastraCode>>['authStorage'];
let signalsPubSub: Awaited<ReturnType<typeof createMastraCode>>['signalsPubSub'];
let analytics: ReturnType<typeof createMastraCodeAnalytics> | undefined;

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

  const tui = new MastraTUI({
    controller: controller,
    session,
    hookManager,
    analytics,
    authStorage,
    mcpManager,
    pluginManager: result.pluginManager,
    appName: 'Mastra Code',
    version: getCurrentVersion(),
    inlineQuestions: true,
    githubSignals: result.githubSignals,
    ...(pipedInput ? { initialMessage: `The following was piped via stdin:\n\n${pipedInput}` } : {}),
  });
  tui.run().catch(error => {
    handleFatalError(error);
  });

  if (settings.browser.enabled) {
    void loadBrowser()
      .then(browser => {
        if (!browser) return;
        controller.setBrowser(browser);
        void session.state.set({ activeBrowserSettings: settings.browser } as any).catch(() => {});
      })
      .catch(() => {});
  }
}

const asyncCleanup = async () => {
  releaseAllThreadLocks();
  const closeSignalsPubSub = (signalsPubSub as { close?: () => Promise<void> | void } | undefined)?.close;
  await Promise.allSettled([
    mcpManager?.disconnect(),
    controller?.getMastra()?.stopWorkers(),
    controller?.stopIntervals(),
    closeSignalsPubSub?.(),
    analytics?.shutdown(),
  ]);
};

process.on('beforeExit', () => {
  void asyncCleanup();
});
process.on('exit', () => {
  restoreTerminalForeground();
  releaseAllThreadLocks();
});
process.on('SIGINT', () => {
  void asyncCleanup().finally(() => process.exit(0));
});
process.on('SIGTERM', () => {
  void asyncCleanup().finally(() => process.exit(0));
});

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

function handleFatalError(error: unknown): never {
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
    process.exit(1);
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
  process.exit(1);
}

async function main() {
  if (process.argv[2] === 'plugin') {
    return pluginMain(process.argv.slice(3));
  }

  if (hasHeadlessFlag(process.argv) || process.argv.includes('--help') || process.argv.includes('-h')) {
    return runMCCli();
  }

  if (process.argv.includes('--acp')) {
    const { acpMain } = await import('./acp/index.js');
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
