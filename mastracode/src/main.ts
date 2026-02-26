#!/usr/bin/env node
/**
 * Main entry point for Mastra Code TUI.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { loadSettings } from './onboarding/settings.js';
import { detectTerminalTheme } from './tui/detect-theme.js';
import { MastraTUI } from './tui/index.js';
import { applyThemeMode } from './tui/theme.js';
import { getAppDataDir } from './utils/project.js';
import { releaseAllThreadLocks } from './utils/thread-lock.js';
import { createMastraCode } from './index.js';

let harness: Awaited<ReturnType<typeof createMastraCode>>['harness'];
let mcpManager: Awaited<ReturnType<typeof createMastraCode>>['mcpManager'];
let hookManager: Awaited<ReturnType<typeof createMastraCode>>['hookManager'];
let authStorage: Awaited<ReturnType<typeof createMastraCode>>['authStorage'];

// Global safety nets — catch any uncaught errors from storage init, etc.
process.on('uncaughtException', error => {
  handleFatalError(error);
});
process.on('unhandledRejection', reason => {
  handleFatalError(reason instanceof Error ? reason : new Error(String(reason)));
});

async function main() {
  const result = await createMastraCode();
  harness = result.harness;
  mcpManager = result.mcpManager;
  hookManager = result.hookManager;
  authStorage = result.authStorage;

  if (result.storageWarning) {
    console.info(`⚠ ${result.storageWarning}`);
  }

  if (mcpManager?.hasServers()) {
    await mcpManager.init();
    const statuses = mcpManager.getServerStatuses();
    const connected = statuses.filter(s => s.connected);
    const failed = statuses.filter(s => !s.connected);
    const totalTools = connected.reduce((sum, s) => sum + s.toolCount, 0);
    console.info(`MCP: ${connected.length} server(s) connected, ${totalTools} tool(s)`);
    for (const s of failed) {
      console.info(`MCP: Failed to connect to "${s.name}": ${s.error}`);
    }
  }

  const logFile = path.join(getAppDataDir(), 'debug.log');
  const logStream = fs.createWriteStream(logFile, { flags: 'a' });
  const fmt = (a: unknown): string => {
    if (typeof a === 'string') return a;
    if (a instanceof Error) return `${a.name}: ${a.message}`;
    try {
      return JSON.stringify(a);
    } catch {
      return String(a);
    }
  };
  console.error = (...args: unknown[]) => {
    logStream.write(`[ERROR] ${new Date().toISOString()} ${args.map(fmt).join(' ')}\n`);
  };
  console.warn = (...args: unknown[]) => {
    logStream.write(`[WARN] ${new Date().toISOString()} ${args.map(fmt).join(' ')}\n`);
  };

  // Detect and apply terminal theme
  // MASTRA_THEME env var is the highest-priority override
  const envTheme = process.env.MASTRA_THEME?.toLowerCase();
  let themeMode: 'dark' | 'light';
  if (envTheme === 'dark' || envTheme === 'light') {
    themeMode = envTheme;
  } else {
    const settings = loadSettings();
    const themePref = settings.preferences.theme;
    themeMode = themePref === 'dark' || themePref === 'light' ? themePref : await detectTerminalTheme();
  }
  applyThemeMode(themeMode);

  const tui = new MastraTUI({
    harness,
    hookManager,
    authStorage,
    mcpManager,
    appName: 'Mastra Code',
    version: '0.1.0',
    inlineQuestions: true,
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

  write(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

main().catch(error => {
  handleFatalError(error);
});
