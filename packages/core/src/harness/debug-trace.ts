/**
 * Unconditional JSONL trace logger for debugging thread-resume and model-load paths.
 * Writes one JSON object per line to $HOME/.mastracode/thread-resume-trace.jsonl.
 * This is temporary instrumentation — remove after root-cause analysis.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

let logPath: string | undefined;

function getLogPath(): string {
  if (!logPath) {
    const dir = path.join(os.homedir(), '.mastracode');
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {
      // best effort
    }
    logPath = path.join(dir, 'thread-resume-trace.jsonl');
  }
  return logPath;
}

export function trace(event: string, data: Record<string, unknown>): void {
  try {
    const entry = JSON.stringify({ ts: new Date().toISOString(), event, ...data });
    fs.appendFileSync(getLogPath(), entry + '\n');
  } catch {
    // never throw from instrumentation
  }
}
