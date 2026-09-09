/**
 * Sync `docs/factory/` from a sandbox checkout into the documents domain.
 *
 * Runs after every repo materialization (the factory keeps no persistent
 * checkout, so a session's sandbox is the only place the repo is on disk) and
 * on an explicit Refresh. Every read goes through `git show <ref>:<path>`
 * against the remote default branch — never the working tree — so a PR-sourced
 * (untrusted) checkout or the session's own branch can never be recorded as
 * default-branch truth.
 *
 * Best-effort by contract: the caller decides whether a failure is fatal; the
 * session start path swallows it so a docs problem can never wedge a run.
 */

import { createHash } from 'node:crypto';

import { sh, shellQuote } from '../../../integrations/github/sandbox.js';
import type { ExecutableSandbox } from '../../../sandbox/materialization.js';
import type { FactoryDocumentScope, FactoryDocumentSnapshot, FactoryDocumentsStorage } from './base.js';
import type { FactoryDocKind } from './catalog.js';
import { FACTORY_DOC_KINDS, FACTORY_DOCS_MANIFEST } from './catalog.js';
import { resolveFactoryDocsManifest } from './manifest.js';

/** Bodies above this are indexed (title, hash, size) but not stored. */
export const MAX_DOC_BYTES = 256 * 1024;
export const MAX_SUMMARY_CHARS = 240;
/** Tight budget: ~16 small git reads, all local to the checkout. */
const SYNC_COMMAND_TIMEOUT_MS = 30_000;

export interface SyncFactoryDocumentsInput extends FactoryDocumentScope {
  sandbox: ExecutableSandbox;
  workdir: string;
  /** The ref to read from — the remote default branch, e.g. `origin/main`. */
  ref: string;
  storage: Pick<FactoryDocumentsStorage, 'replaceSnapshot' | 'syncState'>;
  /** Skip when the stored snapshot already reflects the ref's commit. Defaults to true. */
  skipIfUnchanged?: boolean;
  now?: () => Date;
}

export type SyncFactoryDocumentsResult =
  | { outcome: 'synced'; sourceSha: string; manifestStatus: 'ok' | 'missing' | 'invalid'; warnings: string[] }
  | { outcome: 'unchanged'; sourceSha: string }
  | { outcome: 'ref-unavailable'; reason: string };

export interface DocumentBodyDigest {
  title: string | null;
  summary: string | null;
  contentHash: string;
  sizeBytes: number;
}

/** Title = first ATX heading; summary = first non-heading paragraph, single-spaced and capped. */
export function digestDocumentBody(body: string): DocumentBodyDigest {
  const lines = body.split(/\r?\n/);
  let title: string | null = null;
  const paragraph: string[] = [];
  let inFence = false;
  let inFrontmatter = lines[0]?.trim() === '---';
  for (let index = inFrontmatter ? 1 : 0; index < lines.length; index++) {
    const line = lines[index] ?? '';
    const trimmed = line.trim();
    if (inFrontmatter) {
      if (trimmed === '---') inFrontmatter = false;
      continue;
    }
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (title === null && /^#\s+/.test(trimmed)) {
      title =
        trimmed
          .replace(/^#+\s+/, '')
          .replace(/\s+#+$/, '')
          .trim() || null;
      continue;
    }
    if (paragraph.length === 0) {
      // Skip headings, tables, lists, blockquotes, html, and blanks until prose starts.
      if (!trimmed || /^(#|\||[-*+]\s|\d+\.\s|>|<)/.test(trimmed)) continue;
      paragraph.push(trimmed);
      continue;
    }
    if (!trimmed) break;
    paragraph.push(trimmed);
  }
  const joined = paragraph.join(' ').replace(/\s+/g, ' ').trim();
  const chars = [...joined];
  const summary =
    chars.length === 0
      ? null
      : chars.length > MAX_SUMMARY_CHARS
        ? `${chars.slice(0, MAX_SUMMARY_CHARS - 1).join('')}…`
        : joined;
  return {
    title,
    summary,
    contentHash: createHash('sha256').update(body, 'utf8').digest('hex'),
    sizeBytes: Buffer.byteLength(body, 'utf8'),
  };
}

async function gitShow(
  sandbox: ExecutableSandbox,
  workdir: string,
  ref: string,
  path: string,
): Promise<{ kind: 'present'; body: string } | { kind: 'missing' } | { kind: 'error'; stderr: string }> {
  const result = await sh(sandbox, `git -C ${shellQuote(workdir)} show ${shellQuote(`${ref}:${path}`)}`, {
    timeoutMs: SYNC_COMMAND_TIMEOUT_MS,
  });
  if (result.exitCode === 0) return { kind: 'present', body: result.stdout };
  // git exits 128 for both "path not in tree" and "bad revision"; the caller
  // has already verified the ref, so here it means the file is absent.
  if (result.exitCode === 128) return { kind: 'missing' };
  return { kind: 'error', stderr: result.stderr.trim() };
}

export async function syncFactoryDocuments(input: SyncFactoryDocumentsInput): Promise<SyncFactoryDocumentsResult> {
  const { sandbox, workdir, ref, storage } = input;
  const scope = { orgId: input.orgId, factoryProjectId: input.factoryProjectId };

  const revParse = await sh(
    sandbox,
    `git -C ${shellQuote(workdir)} rev-parse --verify ${shellQuote(`${ref}^{commit}`)}`,
    {
      timeoutMs: SYNC_COMMAND_TIMEOUT_MS,
    },
  );
  if (revParse.exitCode !== 0) {
    return { outcome: 'ref-unavailable', reason: revParse.stderr.trim() || `ref ${ref} not found` };
  }
  const sourceSha = revParse.stdout.trim();

  if (input.skipIfUnchanged !== false) {
    const state = await storage.syncState(scope);
    if (state?.sourceSha === sourceSha && state.sourceRef === ref) return { outcome: 'unchanged', sourceSha };
  }

  const manifestRead = await gitShow(sandbox, workdir, ref, FACTORY_DOCS_MANIFEST);
  if (manifestRead.kind === 'error') throw new Error(`Failed to read ${FACTORY_DOCS_MANIFEST}: ${manifestRead.stderr}`);
  const manifest = resolveFactoryDocsManifest(manifestRead.kind === 'present' ? manifestRead.body : null);
  const warnings = [...manifest.warnings];

  const documents: FactoryDocumentSnapshot[] = [];
  for (const definition of FACTORY_DOC_KINDS) {
    const kind: FactoryDocKind = definition.kind;
    const path = manifest.paths[kind];
    const read = await gitShow(sandbox, workdir, ref, path);
    if (read.kind === 'error') throw new Error(`Failed to read ${path}: ${read.stderr}`);
    if (read.kind === 'missing') {
      documents.push({ kind, path, status: 'missing' });
      continue;
    }
    const digest = digestDocumentBody(read.body);
    if (digest.sizeBytes > MAX_DOC_BYTES) {
      warnings.push(`${path} is ${digest.sizeBytes} bytes; bodies above ${MAX_DOC_BYTES} are indexed but not stored`);
      documents.push({ kind, path, status: 'oversize', ...digest });
      continue;
    }
    documents.push({ kind, path, status: 'present', ...digest, content: read.body });
  }

  await storage.replaceSnapshot({
    ...scope,
    sourceRef: ref,
    sourceSha,
    manifestStatus: manifest.status,
    documents,
    syncedAt: input.now?.(),
  });
  return { outcome: 'synced', sourceSha, manifestStatus: manifest.status, warnings };
}
