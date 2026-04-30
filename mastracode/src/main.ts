#!/usr/bin/env node
/**
 * Main entry point for Mastra Code TUI.
 */
import fs from 'node:fs';

import { isStreamDestroyedError } from './error-classification.js';
import { hasHeadlessFlag, headlessMain } from './headless.js';
import { createBrowserFromSettings, loadSettings } from './onboarding/settings.js';
import { detectTerminalTheme } from './tui/detect-theme.js';
import { MastraTUI } from './tui/index.js';
import { applyThemeMode, restoreTerminalForeground } from './tui/theme.js';
import { setupDebugLogging } from './utils/debug-log.js';
import { drainPipedStdin, reopenStdinFromTTY } from './utils/stdin-pipe.js';
import { releaseAllThreadLocks } from './utils/thread-lock.js';
import { getCurrentVersion } from './utils/update-check.js';
import { createMastraCode } from './index.js';

let harness: Awaited<ReturnType<typeof createMastraCode>>['harness'];
let mcpManager: Awaited<ReturnType<typeof createMastraCode>>['mcpManager'];
let hookManager: Awaited<ReturnType<typeof createMastraCode>>['hookManager'];
let authStorage: Awaited<ReturnType<typeof createMastraCode>>['authStorage'];

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
  // Load browser from settings (before creating harness)
  const settings = loadSettings();
  const browser = await createBrowserFromSettings(settings.browser);

  const result = await createMastraCode({ browser });
  harness = result.harness;
  mcpManager = result.mcpManager;
  hookManager = result.hookManager;
  authStorage = result.authStorage;

  // Track the initial browser settings in harness state for config drift detection
  if (browser) {
    harness.setState({ activeBrowserSettings: settings.browser } as any);
  }

  if (result.storageWarning) {
    console.info(`⚠ ${result.storageWarning}`);
  }
  if (result.observabilityWarning) {
    console.info(`⚠ ${result.observabilityWarning}`);
  }

  if (browser) {
    console.info(`Browser: ${settings.browser.provider} (${settings.browser.headless ? 'headless' : 'visible'})`);
  }

  // MCP connection is deferred to TUI.init() (after ui.start()) so that
  // status messages use showInfo() instead of console.info(), which would
  // corrupt the terminal.  Headless mode still inits from headless.ts.

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

  const tui = new MastraTUI({
    harness,
    hookManager,
    authStorage,
    mcpManager,
    appName: 'Mastra Code',
    version: getCurrentVersion(),
    inlineQuestions: true,
    ...(pipedInput ? { initialMessage: `The following was piped via stdin:\n\n${pipedInput}` } : {}),
  });

  tui.run().catch(error => {
    handleFatalError(error);
  });
}

const asyncCleanup = async () => {
  releaseAllThreadLocks();
  await Promise.allSettled([mcpManager?.disconnect(), harness?.stopHeartbeats()]);
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
  if (hasHeadlessFlag(process.argv) || process.argv.includes('--help') || process.argv.includes('-h')) {
    return headlessMain();
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
    if (!reopenStdinFromTTY()) {
      process.stderr.write('No TTY available — falling back to headless mode.\n');
      return headlessMain(pipedInput);
    }
  }

  return tuiMain(pipedInput);
}

main().catch(error => {
  handleFatalError(error);
});
