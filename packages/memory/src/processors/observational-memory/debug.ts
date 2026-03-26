import { appendFileSync } from 'node:fs';
import { join } from 'node:path';

const OM_DEBUG_LOG = process.env.OM_DEBUG ? join(process.cwd(), 'om-debug.log') : null;

export function omDebug(msg: string) {
  if (!OM_DEBUG_LOG) return;
  try {
    appendFileSync(OM_DEBUG_LOG, `[${new Date().toLocaleString()}] ${msg}\n`);
  } catch {
    // ignore write errors
  }
}

export function omError(msg: string, err?: unknown) {
  const errStr = err instanceof Error ? (err.stack ?? err.message) : err !== undefined ? String(err) : '';
  const full = errStr ? `${msg}: ${errStr}` : msg;
  omDebug(`[OM:ERROR] ${full}`);
}

omDebug(`[OM:process-start] OM module loaded, pid=${process.pid}`);

// Wrap console.error so any unexpected errors also land in the debug log
if (OM_DEBUG_LOG) {
  const _origConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    omDebug(
      `[console.error] ${args
        .map(a => {
          if (a instanceof Error) return a.stack ?? a.message;
          if (typeof a === 'object' && a !== null) {
            try {
              return JSON.stringify(a);
            } catch {
              return String(a);
            }
          }
          return String(a);
        })
        .join(' ')}`,
    );
    _origConsoleError.apply(console, args);
  };
}
