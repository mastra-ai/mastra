import { defaultLimits } from '../contracts/limits.ts';
import type { Projection } from '../contracts/review.ts';
import type { EvidenceSnapshotRecord } from '../evidence/snapshot.ts';
import { loadManifest, validateSnapshotSources } from '../evidence/snapshot.ts';
import type { ProcessingStore } from '../persistence/processing.ts';
import { canonicalJson } from '../intake/source.ts';
import { checkLocalContent } from '../processing/local-filter.ts';
import type { EvidenceLocator } from '../contracts/evidence-locator.ts';
export interface EvidenceValidationOptions {
  evidenceRoot: string;
  manifestPath: string;
}
export const sourceContext = () => ({ limits: defaultLimits, signal: AbortSignal.timeout(defaultLimits.timeoutMs) });
export async function revalidateEvidence(store: ProcessingStore, runId: string, options: EvidenceValidationOptions) {
  const evidence = await store.readEvidence(runId),
    status = await store.status(runId);
  if (!evidence || !status || status.run.evidenceDigest !== evidence.digest) throw new Error('SOURCE_DRIFT');
  await validateSnapshotSources(
    evidence,
    await loadManifest(options.manifestPath),
    options.evidenceRoot,
    sourceContext(),
  );
  return { evidence, status };
}
// Public coordinates intentionally exclude private document titles, file paths and headings.
export function publicLocator(l: EvidenceLocator) {
  switch (l.kind) {
    case 'xlsx.cell':
      return `Sheet ${l.sheet}; cell ${l.cell}`;
    case 'xlsx.range':
      return `Sheet ${l.sheet}; cells ${l.start}:${l.end}`;
    case 'pdf.block':
      return `Page ${l.page}; block ${l.block + 1}`;
    case 'csv.cell':
      return `Row ${l.row}; column ${l.column}`;
    case 'json.pointer':
      return `JSON pointer ${l.pointer}`;
    case 'markdown.lines':
      return `Lines ${l.startLine}-${l.endLine}`;
  }
}
export function containsRestricted(text: string, evidence: EvidenceSnapshotRecord) {
  const normalize = (v: string) =>
    v
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  const normalized = normalize(text);
  return evidence.excerpts
    .filter(e => e.disclosure === 'restricted')
    .some(e => {
      const words = normalize(e.text).split(' ');
      if (words.some(w => w.length >= 20 && normalized.includes(w))) return true;
      for (let i = 0; i <= words.length - 3; i++) if (normalized.includes(words.slice(i, i + 3).join(' '))) return true;
      return normalized.includes(normalize(e.text)) && normalize(e.text).length >= 12;
    });
}
export function projectionTextValues(p: Projection) {
  return [
    p.runId,
    p.organizationId,
    p.approvalId,
    ...p.answers.flatMap(a => [
      a.questionId,
      a.question,
      a.text,
      a.responseOption ?? '',
      a.safeReason,
      ...a.limitations,
    ]),
    ...p.evidence.flatMap(e => [e.id, e.documentId, e.label, e.version, e.locator, e.supportingExcerpt]),
  ];
}
export async function validateProjectionText(projection: Projection, evidence: EvidenceSnapshotRecord) {
  const text = canonicalJson(projection);
  if (containsRestricted(text, evidence)) throw new Error('RESTRICTED_DISCLOSURE');
  for (const value of projectionTextValues(projection)) await checkLocalContent(value, projection.runId);
  // File and URL text is never an artifact capability; private absolute paths are withheld.
  if (/(?:\/Users\/|\/private\/|file:\/\/|[A-Za-z]:\\)/.test(text)) throw new Error('PRIVATE_PATH');
}
