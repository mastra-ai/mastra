import * as fs from 'node:fs';
import * as path from 'node:path';

import { getAppDataDir } from './project.js';

const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5 MB
const KEEP_SIZE = 4 * 1024 * 1024; // 4 MB

/**
 * Truncate a log file to roughly {@link KEEP_SIZE} bytes if it exceeds
 * {@link MAX_LOG_SIZE}, cutting at the first newline so we don't start mid-line.
 */
export function truncateLogFile(logFile: string): void {
  try {
    const stat = fs.statSync(logFile);
    if (stat.size > MAX_LOG_SIZE) {
      const buf = Buffer.alloc(KEEP_SIZE);
      const fd = fs.openSync(logFile, 'r');
      fs.readSync(fd, buf, 0, KEEP_SIZE, stat.size - KEEP_SIZE);
      fs.closeSync(fd);
      const firstNewline = buf.indexOf(10);
      const trimmed = firstNewline >= 0 ? buf.subarray(firstNewline + 1) : buf;
      fs.writeFileSync(logFile, trimmed);
    }
  } catch {
    // File may not exist yet — that's fine
  }
}

/**
 * Set up debug logging. When {@link MASTRA_DEBUG} is `"true"`, redirects
 * `console.error` and `console.warn` to a log file (truncating it first if
 * oversized). Otherwise silences them to avoid corrupting the TUI.
 */
export function setupDebugLogging(): void {
  const debugEnabled = ['true', '1'].includes(process.env.MASTRA_DEBUG!);

  if (debugEnabled) {
    const logFile = path.join(getAppDataDir(), 'debug.log');
    truncateLogFile(logFile);

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
  } else {
    const noop = () => {};
    console.error = noop;
    console.warn = noop;
  }
}
