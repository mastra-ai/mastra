import { applySpecPatch, deepMergeSpec } from '@json-render/core';
import type { EditMode, JsonPatch, PatchOp, Spec } from '@json-render/core';
import { readSpecToolArgs } from './spec';
import type { SpecReadResult } from './spec';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

export const EDIT_MODES: readonly EditMode[] = ['patch', 'merge', 'diff'];
const PATCH_OPS: readonly PatchOp[] = ['add', 'remove', 'replace', 'move', 'copy', 'test'];

/** One edit of an earlier interface, as the model asked for it. */
export interface SpecEdit {
  /** Tool call id of the interface to edit. Omitted: the latest interface before the edit. */
  target?: string;
  mode: EditMode;
  patch?: JsonPatch[];
  merge?: Record<string, unknown>;
  diff?: string;
}

/** Text of a spec as sent to the model, which `diff` edits are written against. */
export const serializeSpec = (spec: Spec) => JSON.stringify(spec, null, 2);

/**
 * Model-facing input of the edit tool. Only the enabled modes' payloads are advertised. Strict structured-output
 * providers close every object, so patch values and merge patches are JSON-encoded strings.
 */
export function specEditInputSchema(modes: readonly EditMode[]) {
  return {
    type: 'object',
    properties: {
      target: {
        type: 'string',
        description: 'The `id` an earlier interface tool call returned. Omit it to edit the latest interface.',
      },
      mode: { type: 'string', enum: [...modes] },
      ...(modes.includes('patch')
        ? {
            patch: {
              type: 'array',
              description: 'RFC 6902 JSON Patch operations, applied in order',
              items: {
                type: 'object',
                properties: {
                  op: { type: 'string', enum: [...PATCH_OPS] },
                  path: { type: 'string', description: 'JSON Pointer into the spec, e.g. /elements/title/props/text' },
                  from: { type: 'string', description: 'Source pointer of move and copy' },
                  value: { type: 'string', description: 'Value of add, replace and test, as JSON' },
                },
                required: ['op', 'path'],
              },
            },
          }
        : {}),
      ...(modes.includes('merge')
        ? {
            merge: {
              type: 'string',
              description: 'RFC 7396 JSON merge patch of the spec, as a JSON object string; null removes a key',
            },
          }
        : {}),
      ...(modes.includes('diff')
        ? { diff: { type: 'string', description: 'Unified diff against the spec text the tool result returned' } }
        : {}),
    },
    required: ['mode'],
  };
}

export function specEditDescription(modes: readonly EditMode[], specToolName: string) {
  return [
    `Change an interface rendered earlier by ${specToolName} or by this tool. The changed interface renders as a new one where this call appears; the earlier one stays as it was, and the values the user set in it carry over as the starting state.`,
    'Edits apply to the json-render spec {root, state, elements: {<id>: {type, props, children?, slots?, visible?, repeat?, on?, watch?}}}, with `slots` as {<name>: [ids]} and `on` / `watch` as {<event or state path>: binding}. Elements use the components, props and expressions of ' +
      `${specToolName}.`,
    modes.includes('patch')
      ? 'mode "patch": `patch` lists RFC 6902 JSON Patch operations, e.g. {"op": "replace", "path": "/elements/title/props/text", "value": "\\"Hello\\""}; `value` is JSON. Append a child with {"op": "add", "path": "/elements/<id>/children/-", "value": "\\"<child id>\\""}.'
      : '',
    modes.includes('merge')
      ? 'mode "merge": `merge` is an RFC 7396 JSON merge patch of the spec: objects merge, other values replace, null removes.'
      : '',
    modes.includes('diff')
      ? 'mode "diff": `diff` is a unified diff against the `spec` text the earlier tool result returned, with a few unchanged context lines around each change.'
      : '',
    'The result returns the new interface `id` to edit it again.',
  ]
    .filter(Boolean)
    .join('\n\n');
}

/** Patch values are JSON, or JSON-encoded in strict mode; a bare string that is not JSON stays a string. */
function readPatchValue(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function readPatchOp(raw: unknown): JsonPatch | string {
  if (!isRecord(raw)) return 'a patch operation must be an object';
  const { op, path, from, value } = raw;
  if (typeof op !== 'string' || !PATCH_OPS.includes(op as PatchOp)) return `unknown patch op "${String(op)}"`;
  if (typeof path !== 'string') return `patch op "${op}" needs a path`;
  const read: JsonPatch = { op: op as PatchOp, path };
  if (op === 'move' || op === 'copy') {
    if (typeof from !== 'string') return `patch op "${op}" needs from`;
    read.from = from;
  }
  if (op === 'add' || op === 'replace' || op === 'test') {
    if (value === undefined || value === null) return `patch op "${op}" at ${path} needs a value`;
    read.value = readPatchValue(value);
  }
  return read;
}

export type SpecEditReadResult = { ok: true; edit: SpecEdit } | { ok: false; error: string };

/**
 * Read the edit tool's arguments. While they stream, the last patch operation may be cut off, so only the
 * operations before it are kept; merge patches and diffs are only read once complete.
 */
export function readSpecEditArgs(args: unknown, complete: boolean, modes: readonly EditMode[]): SpecEditReadResult {
  if (!isRecord(args))
    return complete ? { ok: false, error: 'edit arguments must be an object' } : { ok: true, edit: { mode: 'patch' } };
  const mode = args.mode ?? (args.merge != null ? 'merge' : args.diff != null ? 'diff' : 'patch');
  if (typeof mode !== 'string' || !modes.includes(mode as EditMode)) {
    if (!complete) return { ok: true, edit: { mode: 'patch' } };
    return { ok: false, error: `edit mode "${String(mode)}" is not enabled; use ${modes.join(', ')}` };
  }
  const edit: SpecEdit = { mode: mode as EditMode };
  if (typeof args.target === 'string' && args.target) edit.target = args.target;

  if (mode === 'patch') {
    const raw = Array.isArray(args.patch) ? (complete ? args.patch : args.patch.slice(0, -1)) : undefined;
    if (!raw) return complete ? { ok: false, error: 'mode "patch" needs a `patch` list' } : { ok: true, edit };
    const patch: JsonPatch[] = [];
    for (const item of raw) {
      const op = readPatchOp(item);
      if (typeof op === 'string') return complete ? { ok: false, error: op } : { ok: true, edit: { ...edit, patch } };
      patch.push(op);
    }
    return { ok: true, edit: { ...edit, patch } };
  }
  if (!complete) return { ok: true, edit };
  if (mode === 'merge') {
    const merge = readPatchValue(args.merge);
    if (!isRecord(merge)) return { ok: false, error: 'mode "merge" needs a `merge` object' };
    return { ok: true, edit: { ...edit, merge } };
  }
  if (typeof args.diff !== 'string' || !args.diff.trim()) return { ok: false, error: 'mode "diff" needs a `diff`' };
  return { ok: true, edit: { ...edit, diff: args.diff } };
}

interface Hunk {
  from: number;
  old: string[];
  next: string[];
}

function readHunks(diff: string): Hunk[] {
  const hunks: Hunk[] = [];
  const lines = diff.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
  for (const line of lines) {
    const header = /^@@ -(\d+)/.exec(line);
    if (header) {
      hunks.push({ from: Math.max(0, Number(header[1]) - 1), old: [], next: [] });
      continue;
    }
    const hunk = hunks.at(-1);
    // File headers before the first hunk, and "\ No newline at end of file" markers.
    if (!hunk || line.startsWith('\\')) continue;
    const body = line.slice(1);
    if (line[0] === '-') hunk.old.push(body);
    else if (line[0] === '+') hunk.next.push(body);
    else {
      hunk.old.push(body);
      hunk.next.push(body);
    }
  }
  return hunks;
}

/**
 * Apply a unified diff to `text`. The model never sees line numbers, so hunks are placed by their content
 * (ignoring indentation), at the match nearest the line the hunk header names.
 */
export function applyUnifiedDiff(
  text: string,
  diff: string,
): { ok: true; text: string } | { ok: false; error: string } {
  const lines = text.split('\n');
  const hunks = readHunks(diff);
  if (!hunks.length) return { ok: false, error: 'the diff has no @@ hunks' };
  let offset = 0;
  for (const [index, hunk] of hunks.entries()) {
    const hint = hunk.from + offset;
    let at = -1;
    if (!hunk.old.length) at = Math.min(hint, lines.length);
    else {
      for (let start = 0; start + hunk.old.length <= lines.length; start++) {
        const matches = hunk.old.every((line, i) => line.trim() === lines[start + i]!.trim());
        if (matches && (at === -1 || Math.abs(start - hint) < Math.abs(at - hint))) at = start;
      }
    }
    if (at === -1) return { ok: false, error: `diff hunk ${index + 1} does not match the spec` };
    lines.splice(at, hunk.old.length, ...hunk.next);
    offset += hunk.next.length - hunk.old.length;
  }
  return { ok: true, text: lines.join('\n') };
}

/** Apply an edit to a copy of `base` and read the result back as a spec, like the spec tool's own input. */
export function applySpecEdit(base: Spec, edit: SpecEdit): SpecReadResult {
  let edited: unknown;
  try {
    if (edit.mode === 'patch') {
      const spec = structuredClone(base);
      for (const op of edit.patch ?? []) applySpecPatch(spec, op);
      edited = spec;
    } else if (edit.mode === 'merge') {
      edited = deepMergeSpec(base as unknown as Record<string, unknown>, edit.merge ?? {});
    } else {
      const applied = applyUnifiedDiff(serializeSpec(base), edit.diff ?? '');
      if (!applied.ok) return applied;
      edited = JSON.parse(applied.text);
    }
  } catch (error) {
    return { ok: false, error: `the edit could not be applied: ${errorMessage(error)}` };
  }
  return readSpecToolArgs(edited, true);
}
