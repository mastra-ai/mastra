#!/usr/bin/env node
/**
 * Main entry point for Mastra Code TUI.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { MastraTUI } from './tui/index.js';
import { getAppDataDir } from './utils/project.js';
import { releaseAllThreadLocks } from './utils/thread-lock.js';
import { createMastraCode } from './index.js';

const { harness, mcpManager, hookManager, authStorage } = createMastraCode();

const tui = new MastraTUI({
  harness,
  hookManager,
  authStorage,
  mcpManager,
  appName: 'Mastra Code',
  version: '0.1.0',
  inlineQuestions: true,
});

async function main() {
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
  const originalConsoleError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    logStream.write(`[ERROR] ${new Date().toISOString()} ${args.map(fmt).join(' ')}\n`);
  };
  console.warn = (...args: unknown[]) => {
    logStream.write(`[WARN] ${new Date().toISOString()} ${args.map(fmt).join(' ')}\n`);
  };

  tui.run().catch(error => {
    originalConsoleError('Fatal error:', error);
    process.exit(1);
  });
}

const asyncCleanup = async () => {
  releaseAllThreadLocks();
  await Promise.allSettled([mcpManager?.disconnect(), harness.stopHeartbeats()]);
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

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
