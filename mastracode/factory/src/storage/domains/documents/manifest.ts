/**
 * `docs/factory/manifest.yaml` — maps catalog kinds to files in the repo.
 *
 * The file shape is ours, so the parser reads a strict flat subset of YAML
 * (no dependency): a top-level `version:` scalar and a `documents:` mapping
 * whose entries are `  <kind>: <path>` lines. Comments (`#`) and blank lines
 * are ignored. Anything else — nested blocks, sequences, flow syntax — is a
 * parse error, and the sync falls back to the catalog's default paths.
 *
 * Paths are confined to `docs/factory/` and validated before they ever reach
 * a `git show` command, so a manifest cannot point the sync at arbitrary
 * repository files.
 */

import { z } from 'zod';

import type { FactoryDocKind } from './catalog.js';
import { FACTORY_DOC_KINDS, FACTORY_DOCS_DIR, isFactoryDocKind } from './catalog.js';

export const MAX_MANIFEST_BYTES = 64 * 1024;
export const MAX_DOC_PATH_LENGTH = 256;

/** `docs/factory/<segments>.md` — no `..`, no leading slash, no odd characters. */
const DOC_PATH_RE = new RegExp(
  `^${FACTORY_DOCS_DIR}/(?:[A-Za-z0-9_-][A-Za-z0-9._-]*/)*[A-Za-z0-9_-][A-Za-z0-9._-]*\\.md$`,
);

export const factoryDocPathSchema = z
  .string()
  .max(MAX_DOC_PATH_LENGTH)
  .regex(DOC_PATH_RE, `Document paths must be markdown files under ${FACTORY_DOCS_DIR}/`)
  .refine(value => !value.split('/').includes('..'), 'Document paths must not contain ".."');

export const factoryDocsManifestSchema = z
  .object({
    version: z.literal(1).optional(),
    // Kinds are filtered against the catalog before validation (unknown kinds
    // are warnings, not errors), so the key schema stays open here.
    documents: z.record(z.string(), factoryDocPathSchema),
  })
  .strict();

export type FactoryDocsManifest = z.infer<typeof factoryDocsManifestSchema>;

export type FactoryDocsManifestStatus = 'ok' | 'missing' | 'invalid';

export interface ResolvedFactoryDocsManifest {
  status: FactoryDocsManifestStatus;
  /** Every catalog kind → the path to read; manifest overrides, defaults elsewhere. */
  paths: Record<FactoryDocKind, string>;
  /** Human-readable problems: unknown kinds skipped, or why the manifest was rejected. */
  warnings: string[];
}

export class FactoryDocsManifestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FactoryDocsManifestError';
  }
}

function stripComment(line: string): string {
  // A `#` starts a comment unless it is inside a quoted scalar; the manifest
  // only carries paths, so quotes are optional and never contain `#`.
  const index = line.indexOf('#');
  return index === -1 ? line : line.slice(0, index);
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * Parse the flat manifest subset into a plain object. Throws
 * `FactoryDocsManifestError` on any structure outside the subset; the caller
 * decides whether that means "fall back to defaults".
 */
export function parseFactoryDocsManifestText(text: string): unknown {
  if (Buffer.byteLength(text, 'utf8') > MAX_MANIFEST_BYTES) {
    throw new FactoryDocsManifestError(`Manifest exceeds ${MAX_MANIFEST_BYTES} bytes`);
  }
  const root: Record<string, unknown> = {};
  let currentBlock: Record<string, string> | undefined;
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const raw = stripComment(lines[index] ?? '');
    if (!raw.trim()) continue;
    if (raw.trim() === '---') continue;
    const indent = raw.length - raw.trimStart().length;
    const body = raw.trim();
    const colon = body.indexOf(':');
    if (colon <= 0) throw new FactoryDocsManifestError(`Line ${index + 1}: expected "key: value"`);
    const key = body.slice(0, colon).trim();
    const value = body.slice(colon + 1).trim();
    if (indent === 0) {
      currentBlock = undefined;
      if (value === '') {
        const block: Record<string, string> = {};
        root[key] = block;
        currentBlock = block;
        continue;
      }
      const scalar = unquote(value);
      root[key] = /^-?\d+$/.test(scalar) ? Number(scalar) : scalar;
      continue;
    }
    if (!currentBlock) throw new FactoryDocsManifestError(`Line ${index + 1}: indented entry outside a mapping`);
    if (value === '') throw new FactoryDocsManifestError(`Line ${index + 1}: nested mappings are not supported`);
    if (key in currentBlock) throw new FactoryDocsManifestError(`Line ${index + 1}: duplicate key "${key}"`);
    currentBlock[key] = unquote(value);
  }
  return root;
}

function defaultPaths(): Record<FactoryDocKind, string> {
  return Object.fromEntries(FACTORY_DOC_KINDS.map(definition => [definition.kind, definition.defaultPath])) as Record<
    FactoryDocKind,
    string
  >;
}

/**
 * Resolve the manifest text (or its absence) into one path per catalog kind.
 * Never throws: a missing or invalid manifest resolves to default paths with
 * the reason recorded, so the sync can still index whatever is on disk.
 */
export function resolveFactoryDocsManifest(text: string | null): ResolvedFactoryDocsManifest {
  const paths = defaultPaths();
  if (text === null) return { status: 'missing', paths, warnings: [] };

  let parsed: unknown;
  try {
    parsed = parseFactoryDocsManifestText(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 'invalid', paths, warnings: [`Manifest could not be parsed: ${message}`] };
  }

  const warnings: string[] = [];
  // Unknown kinds are dropped before validation so a future kind in the
  // manifest never invalidates the known ones.
  const documents = (parsed as { documents?: unknown })?.documents;
  if (documents && typeof documents === 'object' && !Array.isArray(documents)) {
    const filtered: Record<string, unknown> = {};
    for (const [kind, value] of Object.entries(documents as Record<string, unknown>)) {
      if (isFactoryDocKind(kind)) filtered[kind] = value;
      else warnings.push(`Manifest maps unknown document kind "${kind}"; ignored`);
    }
    (parsed as { documents: unknown }).documents = filtered;
  }

  const result = factoryDocsManifestSchema.safeParse(parsed);
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue?.path.length ? ` at ${issue.path.join('.')}` : '';
    return {
      status: 'invalid',
      paths,
      warnings: [...warnings, `Manifest is invalid${where}: ${issue?.message ?? 'unknown error'}`],
    };
  }

  const seen = new Map<string, FactoryDocKind>();
  for (const [kind, path] of Object.entries(result.data.documents) as Array<[FactoryDocKind, string]>) {
    const owner = seen.get(path);
    if (owner) {
      return {
        status: 'invalid',
        paths: defaultPaths(),
        warnings: [...warnings, `Manifest maps "${owner}" and "${kind}" to the same file ${path}`],
      };
    }
    seen.set(path, kind);
    paths[kind] = path;
  }
  // A manifest override may collide with another kind's default path.
  for (const definition of FACTORY_DOC_KINDS) {
    const path = paths[definition.kind];
    const owner = seen.get(path);
    if (owner && owner !== definition.kind) {
      return {
        status: 'invalid',
        paths: defaultPaths(),
        warnings: [...warnings, `Manifest maps "${owner}" to ${path}, the default file of "${definition.kind}"`],
      };
    }
  }
  return { status: 'ok', paths, warnings };
}
