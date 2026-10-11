import { mkdir, writeFile, chmod, mkdtemp, rename, readdir, rm, lstat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Workspace, LocalFilesystem } from '@mastra/core/workspace';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { manifestSchema } from '../contracts/evidence-manifest.ts';
import { evidenceLocatorSchema } from '../contracts/evidence-locator.ts';
import { evidenceSnapshotSchema, evidenceScopeSchema } from '../contracts/evidence-snapshot.ts';
import { evidenceCitationSchema } from '../contracts/evidence-citation.ts';
import type { EvidenceDocument } from '../contracts/evidence-manifest.ts';
import type { EvidenceLocator } from '../contracts/evidence-locator.ts';
import type { EvidenceCitation } from '../contracts/evidence-citation.ts';
import { readSource, readJson, runParser, sha256, canonicalJson, IntakeFailure } from '../intake/source.ts';
import type { InputAdapterContext, InputSourceSnapshot } from '../intake/source.ts';
import type { ExtractedBlock } from '../parsers/contract.ts';

export { evidenceScopeSchema };
export type EvidenceScope = z.infer<typeof evidenceScopeSchema>;
export interface EvidenceExcerpt {
  id: string;
  documentId: string;
  version: string;
  sourceSha256: string;
  citationLabel: string;
  kind: EvidenceDocument['kind'];
  disclosure: EvidenceDocument['disclosure'];
  locator: EvidenceLocator;
  text: string;
}
export interface DeniedEvidence {
  documentId: string;
  citationLabel: string;
  reason: 'NOT_APPROVED' | 'NOT_VALID' | 'WRONG_SCOPE' | 'LLM_PROHIBITED' | 'HASH_MISMATCH';
}
export interface EligibleSource {
  document: EvidenceDocument;
  source: InputSourceSnapshot;
  blocks: ExtractedBlock[];
}
export interface EvidenceSnapshotRecord {
  schemaVersion: 1;
  runId: string;
  digest: string;
  manifestDigest: string;
  scope: EvidenceScope;
  asOf: string;
  documents: EvidenceDocument[];
  excerpts: EvidenceExcerpt[];
  denied: DeniedEvidence[];
}
function deniedReason(d: EvidenceDocument, scope: EvidenceScope, now: string): DeniedEvidence['reason'] | undefined {
  if (d.approvalState !== 'approved') return 'NOT_APPROVED';
  if (d.validFrom > now || d.validUntil <= now || !d.approvedAt || d.approvedAt > now) return 'NOT_VALID';
  if (
    d.scope.organizationId !== scope.organizationId ||
    !d.scope.products.includes(scope.product) ||
    !d.scope.environments.includes(scope.environment) ||
    !scope.domains.some(domain => d.scope.domains.includes(domain))
  )
    return 'WRONG_SCOPE';
  if (!d.llmAllowed) return 'LLM_PROHIBITED';
  return undefined;
}
const extensions: Record<EvidenceDocument['format'], readonly string[]> = {
  xlsx: ['.xlsx'],
  pdf: ['.pdf'],
  csv: ['.csv'],
  json: ['.json'],
  markdown: ['.md', '.markdown'],
};
export async function buildEvidenceSnapshot(options: {
  runId: string;
  manifest: unknown;
  root: string;
  runtimeRoot: string;
  scope: EvidenceScope;
  asOf?: string;
  context: InputAdapterContext;
}) {
  const { context } = options;
  const runId = z
    .string()
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,100}$/)
    .parse(options.runId);
  const manifest = manifestSchema.parse(options.manifest);
  const scope = evidenceScopeSchema.parse(options.scope);
  if (scope.organizationId !== manifest.organizationId) throw new IntakeFailure('INVALID_MAPPING', runId);
  const asOf = z.iso.datetime().parse(options.asOf ?? new Date().toISOString());
  if (manifest.documents.length > context.limits.maxEvidenceDocuments) throw new IntakeFailure('LIMIT_EXCEEDED', runId);
  const sources: EligibleSource[] = [],
    denied: DeniedEvidence[] = [],
    excerpts: EvidenceExcerpt[] = [];
  let aggregate = 0;
  for (const d of manifest.documents) {
    const reason = deniedReason(d, scope, asOf);
    if (reason) {
      denied.push({ documentId: d.id, citationLabel: d.citationLabel, reason });
      continue;
    }
    if (!extensions[d.format].some(e => d.relativePath.toLowerCase().endsWith(e)))
      throw new IntakeFailure('FORMAT_MISMATCH', d.id);
    const source = await readSource(d.relativePath, d.id, context.limits, options.root);
    aggregate += source.sizeBytes;
    if (aggregate > context.limits.maxAggregateBytes) throw new IntakeFailure('LIMIT_EXCEEDED', d.id);
    if (source.sha256 !== d.sha256) {
      denied.push({ documentId: d.id, citationLabel: d.citationLabel, reason: 'HASH_MISMATCH' });
      continue;
    }
    const blocks = await runParser<ExtractedBlock[]>(source, d.format, 'evidence', context);
    sources.push({ document: d, source, blocks });
    for (const [index, b] of blocks.entries()) {
      const locator = evidenceLocatorSchema.parse({ ...b.locator, sourceId: d.id, sourceSha256: d.sha256 });
      for (let start = 0; start < b.text.length; start += 4000)
        excerpts.push({
          id: `${d.id}:${index}:${start}`,
          documentId: d.id,
          version: d.version,
          sourceSha256: d.sha256,
          citationLabel: d.citationLabel,
          kind: d.kind,
          disclosure: d.disclosure,
          locator,
          text: b.text.slice(start, start + 4000),
        });
    }
  }
  const base = {
    schemaVersion: 1 as const,
    runId,
    manifestDigest: sha256(canonicalJson(manifest)),
    scope,
    asOf,
    documents: sources.map(s => s.document),
    excerpts,
    denied,
  };
  const record: EvidenceSnapshotRecord = evidenceSnapshotSchema.parse({
    ...base,
    digest: sha256(canonicalJson({ ...base, asOf: undefined })),
  });
  // A fresh, run-scoped directory contains eligible excerpts only. Never mount original evidence.
  const directory = resolve(options.runtimeRoot, 'snapshots', `${runId}-${record.digest}`);
  await mkdir(resolve(options.runtimeRoot, 'snapshots'), { recursive: true });
  const paths = new Map(excerpts.map((e, index) => [e.id, `excerpt-${index}.txt`]));
  const temporary = await mkdtemp(resolve(options.runtimeRoot, 'snapshots', `.${runId}-`));
  try {
    for (const e of excerpts)
      await writeFile(resolve(temporary, paths.get(e.id)!), e.text, { flag: 'wx', mode: 0o400 });
    await writeFile(resolve(temporary, 'snapshot.json'), canonicalJson(record), { flag: 'wx', mode: 0o400 });
    await chmod(temporary, 0o500);
    try {
      await rename(temporary, directory);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'EEXIST' && code !== 'ENOTEMPTY' && code !== 'EACCES') throw error;
      const stat = await lstat(directory);
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new IntakeFailure('READ_FAILED', runId);
      const expected = [...paths.values(), 'snapshot.json'].sort();
      if (canonicalJson((await readdir(directory)).sort()) !== canonicalJson(expected))
        throw new IntakeFailure('SOURCE_CHANGED', runId);
      for (const e of excerpts) {
        const existing = await readSource(paths.get(e.id)!, e.documentId, context.limits, directory);
        if (new TextDecoder().decode(existing.bytes) !== e.text)
          throw new IntakeFailure('SOURCE_CHANGED', e.documentId);
      }
      const existingRecord = evidenceSnapshotSchema.parse(
        await readJson(resolve(directory, 'snapshot.json'), 'evidence-snapshot', context.limits.maxAggregateBytes),
      );
      if (canonicalJson({ ...existingRecord, asOf: undefined }) !== canonicalJson({ ...record, asOf: undefined }))
        throw new IntakeFailure('SOURCE_CHANGED', runId);
      record.asOf = existingRecord.asOf;
    }
  } finally {
    await chmod(temporary, 0o700).catch(() => {});
    await rm(temporary, { recursive: true, force: true });
  }
  const fs = new LocalFilesystem({ basePath: directory, contained: true, readOnly: true });
  const workspace = new Workspace({
    id: `evidence-${runId}`,
    filesystem: fs,
    bm25: true,
    autoSync: false,
    tools: {
      enabled: false,
      mastra_workspace_read_file: { enabled: true },
      mastra_workspace_search: { enabled: true },
    },
  });
  await workspace.init();
  for (const e of excerpts) await workspace.index(e.id, e.text);
  const byId = new Map(excerpts.map(e => [e.id, e]));
  async function read(id: string): Promise<EvidenceExcerpt> {
    const e = byId.get(z.string().max(240).parse(id));
    if (!e) throw new IntakeFailure('READ_FAILED', runId);
    const bytes = await fs.readFile(paths.get(id)!);
    if (String(bytes) !== e.text) throw new IntakeFailure('SOURCE_CHANGED', e.documentId);
    return structuredClone(e);
  }
  async function search(query: string, topK = 5): Promise<Array<{ excerpt: EvidenceExcerpt; score: number }>> {
    const args = z
      .object({ query: z.string().min(1).max(1000), topK: z.int().positive().max(10) })
      .strict()
      .parse({ query, topK });
    const hits = await workspace.search(args.query, { topK: args.topK, mode: 'bm25' });
    const results = [];
    for (const hit of hits) {
      if (!byId.has(hit.id)) throw new IntakeFailure('INVALID_MAPPING', runId);
      results.push({ excerpt: await read(hit.id), score: hit.score });
    }
    return results;
  }
  const tools = Object.freeze({
    evidence_search: createTool({
      id: 'evidence_search',
      description:
        'Search only this run’s approved LLM-permitted evidence excerpts. Scores rank retrieval and are not confidence probabilities.',
      inputSchema: z
        .object({ query: z.string().min(1).max(1000), topK: z.int().positive().max(10).default(5) })
        .strict(),
      execute: async input => search(input.query, input.topK),
    }),
    evidence_read: createTool({
      id: 'evidence_read',
      description:
        'Read an eligible excerpt by an exact ID returned from evidence search. No path, URL or mutation arguments are accepted.',
      inputSchema: z.object({ id: z.string().min(1).max(240) }).strict(),
      execute: async input => read(input.id),
    }),
  });
  return Object.freeze({ record: structuredClone(record), sources, tools, read, search });
}
export async function resolveEvidenceLocator(
  source: InputSourceSnapshot,
  format: EvidenceDocument['format'],
  raw: EvidenceLocator,
  context: InputAdapterContext,
): Promise<string> {
  const locator = evidenceLocatorSchema.parse(raw);
  if (locator.sourceId !== source.sourceId || locator.sourceSha256 !== source.sha256)
    throw new IntakeFailure('SOURCE_CHANGED', source.sourceId);
  const blocks = await runParser<ExtractedBlock[]>(source, format, 'evidence', context);
  const key = canonicalJson(locator);
  const b = blocks.find(
    b => canonicalJson({ ...b.locator, sourceId: source.sourceId, sourceSha256: source.sha256 }) === key,
  );
  if (!b) throw new IntakeFailure('INVALID_MAPPING', source.sourceId);
  return b.text;
}
export async function validateSnapshotSources(
  record: EvidenceSnapshotRecord,
  manifest: unknown,
  root: string,
  context: InputAdapterContext,
  asOf = new Date().toISOString(),
): Promise<void> {
  const m = manifestSchema.parse(manifest);
  if (sha256(canonicalJson(m)) !== record.manifestDigest) throw new IntakeFailure('SOURCE_CHANGED', record.runId);
  for (const old of record.documents) {
    const d = m.documents.find(d => d.id === old.id);
    if (!d || deniedReason(d, record.scope, asOf)) throw new IntakeFailure('SOURCE_CHANGED', old.id);
    const s = await readSource(d.relativePath, d.id, context.limits, root);
    if (s.sha256 !== old.sha256) throw new IntakeFailure('SOURCE_CHANGED', old.id);
  }
}
export async function loadManifest(path: string): Promise<unknown> {
  return readJson(path, 'evidence-manifest');
}

export async function validateEvidenceCitation(
  record: EvidenceSnapshotRecord,
  raw: EvidenceCitation,
  root: string,
  context: InputAdapterContext,
): Promise<EvidenceCitation> {
  const snapshot = evidenceSnapshotSchema.parse(record),
    citation = evidenceCitationSchema.parse(raw);
  const document = snapshot.documents.find(
    d => d.id === citation.documentId && d.version === citation.version && d.sha256 === citation.sourceSha256,
  );
  if (!document || deniedReason(document, snapshot.scope, new Date().toISOString()))
    throw new IntakeFailure('SOURCE_CHANGED', citation.documentId);
  const source = await readSource(document.relativePath, document.id, context.limits, root);
  const original = await resolveEvidenceLocator(source, document.format, citation.locator, context);
  if (
    !original.includes(citation.supportingExcerpt) ||
    !snapshot.excerpts.some(
      e =>
        e.documentId === citation.documentId &&
        canonicalJson(e.locator) === canonicalJson(citation.locator) &&
        e.text.includes(citation.supportingExcerpt),
    )
  )
    throw new IntakeFailure('INVALID_MAPPING', citation.documentId);
  return citation;
}
