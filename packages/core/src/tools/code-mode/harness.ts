/**
 * Code Mode — Sandbox harness
 *
 * Builds the JavaScript program that runs *inside* the sandbox. The harness:
 *  - defines an `external_<name>` function per allow-listed tool, each of which
 *    emits a JSON-RPC request on the protocol channel and awaits its response
 *    (matched by `id`, so `Promise.all` calls resolve independently);
 *  - wraps the model's program in an async function, captures `console.*`, and
 *    emits a terminal `done` frame.
 *
 * Protocol (host <-> harness), newline-delimited JSON on stdout/stdin:
 *  - Frames the harness emits are prefixed with FRAME_PREFIX so the host can
 *    tell them apart from any stray output. Forms: `rpc`, `log`, `done`.
 *  - The host writes `rpc-result` frames to the harness stdin (no prefix).
 */

/** Marks a line on stdout as a Code Mode protocol frame. */
export const FRAME_PREFIX = '\u0000CODEMODE\u0000';

export interface BuildHarnessOptions {
  /**
   * Module specifier the harness imports to obtain the user program. The
   * referenced module must `export default` an async function (the wrapped
   * model code). Written as a sibling `.ts` file so the sandbox's `node`
   * strips the TypeScript types natively at import time.
   */
  programModule: string;
  /** Map of `external_<name>` -> original tool id used in the RPC request. */
  externals: Array<{ externalName: string; toolId: string }>;
}

/**
 * Wrap the model's TypeScript program as a default-exported async function
 * module. Written to a `.ts` file; Node strips the type annotations at import.
 * Top-level `return`, `await`, and `const` work because the body lives inside
 * an async function.
 */
export function buildProgramModule(program: string): string {
  return `export default async function () {\n${program}\n}\n`;
}

/**
 * Produce the full harness source to write into the sandbox and run with node.
 */
export function buildHarness({ programModule, externals }: BuildHarnessOptions): string {
  // Externals are emitted as JSON data, not interpolated identifiers. The
  // harness installs each `external_<name>` global in a loop using bracket
  // assignment, so no caller-derived string is ever spliced into the generated
  // source as code. This keeps tool ids strictly data, even if `sanitize`
  // changes.
  const externalsJson = JSON.stringify(externals.map(({ externalName, toolId }) => ({ externalName, toolId })));

  return `'use strict';
const FRAME_PREFIX = ${JSON.stringify(FRAME_PREFIX)};

function __emit(frame) {
  process.stdout.write(FRAME_PREFIX + JSON.stringify(frame) + '\\n');
}

// ---- console capture -------------------------------------------------------
for (const level of ['log', 'info', 'warn', 'error']) {
  console[level] = (...args) => {
    const message = args
      .map((a) => (typeof a === 'string' ? a : safeStringify(a)))
      .join(' ');
    __emit({ type: 'log', level, message });
  };
}
function safeStringify(value) {
  try { return JSON.stringify(value); } catch { return String(value); }
}

// ---- RPC bridge ------------------------------------------------------------
let __nextId = 0;
const __pending = new Map();

function __rpc(tool, args) {
  const id = __nextId++;
  return new Promise((resolve, reject) => {
    __pending.set(id, { resolve, reject });
    __emit({ type: 'rpc', id, tool, args });
  });
}

let __stdinBuffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  __stdinBuffer += chunk;
  let idx;
  while ((idx = __stdinBuffer.indexOf('\\n')) >= 0) {
    const line = __stdinBuffer.slice(0, idx);
    __stdinBuffer = __stdinBuffer.slice(idx + 1);
    if (!line) continue;
    let frame;
    try { frame = JSON.parse(line); } catch { continue; }
    if (frame && frame.type === 'rpc-result') {
      const entry = __pending.get(frame.id);
      if (!entry) continue;
      __pending.delete(frame.id);
      if (frame.ok) entry.resolve(frame.result);
      else {
        const err = new Error(frame.error?.message || 'external tool failed');
        if (frame.error?.name) err.name = frame.error.name;
        entry.reject(err);
      }
    }
  }
});

// ---- externals -------------------------------------------------------------
for (const { externalName, toolId } of ${externalsJson}) {
  globalThis['external_' + externalName] = (input) => __rpc(toolId, input);
}

// ---- user program ----------------------------------------------------------
// The program lives in a sibling .ts module exporting a default async function;
// node strips its TypeScript types natively on import.
async function __main() {
  const mod = await import(${JSON.stringify(programModule)});
  return await mod.default();
}

__main()
  .then((result) => {
    __emit({ type: 'done', ok: true, result });
    process.exit(0);
  })
  .catch((error) => {
    __emit({
      type: 'done',
      ok: false,
      error: { message: error?.message ?? String(error), name: error?.name },
    });
    process.exit(0);
  });
`;
}
