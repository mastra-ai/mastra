/**
 * Code Mode — Sandbox runner
 *
 * Builds the JavaScript program that runs *inside* the sandbox. The runner:
 *  - defines an `external_<name>` function per allow-listed tool, each of which
 *    emits a JSON-RPC request on the protocol channel and awaits its response
 *    (matched by `id`, so `Promise.all` calls resolve independently);
 *  - wraps the model's program in an async function, captures `console.*`, and
 *    emits a terminal `done` frame.
 *
 * Protocol (host <-> runner), newline-delimited JSON on stdout/stdin:
 *  - Frames the runner emits are prefixed with FRAME_PREFIX so the host can
 *    tell them apart from any stray output. Forms: `rpc`, `log`, `done`.
 *  - The host writes `rpc-result` frames to the runner stdin (no prefix).
 */

/** Marks a line on stdout as a Code Mode protocol frame. */
export const FRAME_PREFIX = '\u0000CODEMODE\u0000';

export interface BuildRunnerOptions {
  /**
   * Module specifier the runner imports to obtain the user program. The
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
 * Produce the full runner source to write into the sandbox and run with node.
 */
export function buildRunner({ programModule, externals }: BuildRunnerOptions): string {
  // `buildRunner` is exported, so a caller could pass a non-sanitized name.
  // External names become global property suffixes, so reject anything that
  // isn't a legal identifier instead of producing an unusable global.
  const SAFE_IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
  const seen = new Map<string, string>();
  for (const { externalName, toolId } of externals) {
    if (!SAFE_IDENT.test(externalName)) {
      throw new Error(`Invalid Code Mode external identifier: ${externalName}`);
    }
    // Two tool ids can sanitize to the same external name (e.g. `a-b` and
    // `a_b` both become `a_b`). The install loop below would silently overwrite
    // the earlier global, leaving one tool unreachable. Fail fast instead.
    const existing = seen.get(externalName);
    if (existing) {
      throw new Error(
        `Code Mode external identifier collision: tools "${existing}" and "${toolId}" both map to external_${externalName}`,
      );
    }
    seen.set(externalName, toolId);
  }

  // Externals are emitted as JSON data, not interpolated identifiers. The
  // runner installs each `external_<name>` global in a loop using bracket
  // assignment, so no caller-derived string is ever spliced into the generated
  // source as code. This keeps tool ids strictly data, even if `sanitize`
  // changes.
  const externalsJson = JSON.stringify(externals.map(({ externalName, toolId }) => ({ externalName, toolId })));

  return `'use strict';
const FRAME_PREFIX = ${JSON.stringify(FRAME_PREFIX)};

function __emit(frame) {
  process.stdout.write(FRAME_PREFIX + JSON.stringify(frame) + '\\n');
}

function __emitDoneAndExit(frame) {
  process.stdout.write(FRAME_PREFIX + JSON.stringify(frame) + '\\n', () => process.exit(0));
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
    __emitDoneAndExit({ type: 'done', ok: true, result });
  })
  .catch((error) => {
    __emitDoneAndExit({
      type: 'done',
      ok: false,
      error: { message: error?.message ?? String(error), name: error?.name },
    });
  });
`;
}
