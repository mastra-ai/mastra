import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { writeFile, readFile, symlink, mkdir, lstat, readdir, chmod } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { LocalFilesystem } from '@mastra/core/workspace';
import {
  buildEvidenceSnapshot,
  resolveEvidenceLocator,
  validateSnapshotSources,
  validateEvidenceCitation,
  loadManifest,
} from '../../src/mastra/evidence/snapshot.ts';
import type { EvidenceScope } from '../../src/mastra/evidence/snapshot.ts';
import { readSource, runParser, sha256 } from '../../src/mastra/intake/source.ts';
import { IntakeCoordinator } from '../../src/mastra/intake/adapters.ts';
import { openIntakeStore } from '../../src/mastra/persistence/store.ts';
import { manifestSchema } from '../../src/mastra/contracts/evidence-manifest.ts';
import type { EvidenceDocument, EvidenceManifest } from '../../src/mastra/contracts/evidence-manifest.ts';
import type { ExtractedBlock } from '../../src/mastra/parsers/contract.ts';
import { generateCorpus } from '../fixtures/corpus.ts';
import { pdfFixture, xlsxFixture } from '../fixtures/office.ts';
import { source, tableMapping, context, temporaryDirectory, cleanupDirectory } from '../fixtures/support.ts';

let root: string;
const asOf = '2026-10-01T00:00:00.000Z';
const scope: EvidenceScope = {
  organizationId: 'northstar',
  product: 'tasks',
  environment: 'production',
  domains: ['governance', 'access', 'data', 'vulnerability', 'incident', 'continuity', 'privacy'],
};
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(asOf));
  root = await temporaryDirectory();
});
afterEach(async () => {
  await cleanupDirectory(root);
  vi.useRealTimers();
});
async function build(manifest: EvidenceManifest, runId = 'evidence-run') {
  return buildEvidenceSnapshot({
    runId,
    manifest,
    root: resolve(root, 'evidence'),
    runtimeRoot: resolve(root, 'runtime'),
    scope,
    asOf,
    context: context(),
  });
}

describe('approved evidence extraction and contained snapshots', () => {
  it('preserves astral characters at excerpt boundaries and can reopen the same snapshot', async () => {
    const manifest = await generateCorpus(root);
    const document = manifest.documents.find(d => d.format === 'markdown')!;
    const text = 'a'.repeat(3999) + '😀' + 'b'.repeat(3997) + '𐐀' + 'tail';
    await writeFile(resolve(root, 'evidence', document.relativePath), text);
    document.sha256 = sha256(text);
    const selected = { ...manifest, documents: [document] };
    const first = await build(selected);
    expect(first.record.excerpts.map(e => e.text).join('')).toBe(text);
    expect(first.record.excerpts.map(e => e.text.length)).toEqual([3999, 3999, 6]);
    for (const excerpt of first.record.excerpts) {
      expect(Buffer.from(excerpt.text).toString('utf8')).toBe(excerpt.text);
      expect((await first.read(excerpt.id)).text).toBe(excerpt.text);
    }
    const reopened = await build(selected);
    expect(reopened.record).toEqual(first.record);
    for (const excerpt of reopened.record.excerpts) expect((await reopened.read(excerpt.id)).text).toBe(excerpt.text);
  });

  it('resolves_original_evidence_locators_in_all_five_formats', async () => {
    const manifest = await generateCorpus(root);
    const originals = new Map<string, Buffer>();
    for (const d of manifest.documents) originals.set(d.id, await readFile(resolve(root, 'evidence', d.relativePath)));
    const snapshot = await build(manifest);
    expect(new Set(snapshot.record.documents.map(d => d.format))).toEqual(
      new Set(['markdown', 'json', 'csv', 'pdf', 'xlsx']),
    );
    expect(snapshot.record.documents).toHaveLength(7);
    for (const document of snapshot.record.documents) {
      const original = await readSource(
        document.relativePath,
        document.id,
        context().limits,
        resolve(root, 'evidence'),
      );
      const excerpt = snapshot.record.excerpts.find(e => e.documentId === document.id)!;
      expect(await resolveEvidenceLocator(original, document.format, excerpt.locator, context())).toContain(
        excerpt.text,
      );
      await expect(
        validateEvidenceCitation(
          snapshot.record,
          {
            id: `citation-${document.id}`,
            documentId: document.id,
            version: document.version,
            sourceSha256: document.sha256,
            locator: excerpt.locator,
            supportingExcerpt: excerpt.text,
          },
          resolve(root, 'evidence'),
          context(),
        ),
      ).resolves.toMatchObject({ documentId: document.id });
      expect(await readFile(resolve(root, 'evidence', document.relativePath))).toEqual(originals.get(document.id));
    }
    expect(snapshot.record.excerpts.find(e => e.documentId === 'incident')!.locator).toMatchObject({
      kind: 'pdf.block',
      page: 1,
      block: 0,
    });
    expect(snapshot.record.excerpts.find(e => e.documentId === 'vulnerability')!.locator).toMatchObject({
      kind: 'csv.cell',
      row: 1,
      column: 1,
    });
    expect(snapshot.record.excerpts.find(e => e.documentId === 'data')!.locator).toMatchObject({
      kind: 'json.pointer',
      pointer: '/production/inTransit',
    });
    expect(snapshot.record.excerpts.find(e => e.documentId === 'continuity')!.locator).toMatchObject({
      kind: 'xlsx.cell',
      sheet: 'Recovery records',
      cell: 'A1',
    });
    const hit = (await snapshot.search('MFA'))[0]!;
    expect(hit.excerpt).toMatchObject({
      documentId: 'access',
      text: 'Workforce administrative accounts require MFA.',
      locator: { kind: 'markdown.lines', heading: 'Workforce access', startLine: 2, endLine: 2 },
    });
    expect(hit.score).toBeGreaterThan(0);
    expect((await snapshot.read(hit.excerpt.id)).text).toBe(hit.excerpt.text);
    const original = await readSource('access.md', 'access', context().limits, resolve(root, 'evidence'));
    await expect(
      resolveEvidenceLocator(original, 'markdown', { ...hit.excerpt.locator, sourceSha256: '0'.repeat(64) }, context()),
    ).rejects.toMatchObject({ code: 'SOURCE_CHANGED' });
    await expect(
      validateEvidenceCitation(
        snapshot.record,
        {
          id: 'fabricated',
          documentId: 'access',
          version: '1.0',
          sourceSha256: original.sha256,
          locator: hit.excerpt.locator,
          supportingExcerpt: 'A fabricated guarantee.',
        },
        resolve(root, 'evidence'),
        context(),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_MAPPING' });
    const quoted = source(
      new TextEncoder().encode('name,description\n"A,B","First line\nSecond line"\n'),
      'quoted.csv',
      'quoted-csv',
    );
    const csv = await runParser<ExtractedBlock[]>(quoted, 'csv', 'evidence', context());
    expect(csv.find(b => b.locator.row === 2 && b.locator.column === 2)).toEqual({
      text: 'First line\nSecond line',
      locator: { kind: 'csv.cell', row: 2, column: 2 },
    });
    const escaped = source(
      new TextEncoder().encode('{"a/b":{"~key":"Literal  value"},"zero":0}'),
      'escaped.json',
      'escaped-json',
    );
    expect(await runParser<ExtractedBlock[]>(escaped, 'json', 'evidence', context())).toContainEqual({
      text: 'Literal  value',
      locator: { kind: 'json.pointer', pointer: '/a~1b/~0key' },
    });
    for (const bytes of [
      pdfFixture([]),
      pdfFixture(['Text'], { catalog: '/OpenAction << /S /JavaScript /JS (app.alert) >>' }),
      pdfFixture(['Text'], { page: '/Annots [<< /Type /Annot /Subtype /Text /Rect [0 0 20 20] >>]' }),
    ])
      await expect(
        runParser(source(bytes, 'unsafe.pdf', 'unsafe-pdf'), 'pdf', 'evidence', context()),
      ).rejects.toMatchObject({ code: 'UNSUPPORTED_LAYOUT' });
    await expect(
      runParser(
        source(new TextEncoder().encode('%PDF-incomplete'), 'broken.pdf', 'broken-pdf'),
        'pdf',
        'evidence',
        context(),
      ),
    ).rejects.toMatchObject({ code: 'CORRUPT_FILE' });
  }, 60_000);
  it('excludes_unapproved_expired_wrong_scope_and_llm_prohibited_evidence', async () => {
    const manifest = await generateCorpus(root);
    const denied = manifestSchema.parse(await loadManifest(resolve(root, 'manifest-denied.json')));
    const snapshot = await build(denied);
    expect(snapshot.record.denied).toEqual(
      expect.arrayContaining([
        { documentId: 'overview', citationLabel: 'Northstar overview v1', reason: 'NOT_APPROVED' },
        { documentId: 'access', citationLabel: 'Northstar access v1', reason: 'NOT_VALID' },
        { documentId: 'data', citationLabel: 'Northstar data v1', reason: 'WRONG_SCOPE' },
        { documentId: 'vulnerability', citationLabel: 'Northstar vulnerability v1', reason: 'HASH_MISMATCH' },
        { documentId: 'privacy', citationLabel: 'Northstar privacy v1', reason: 'LLM_PROHIBITED' },
      ]),
    );
    const allowed = new Set(snapshot.record.documents.map(d => d.id));
    expect(allowed).toEqual(new Set(['incident', 'continuity', 'assurance']));
    expect(snapshot.record.excerpts.every(e => allowed.has(e.documentId))).toBe(true);
    for (const id of ['overview', 'access', 'data', 'vulnerability', 'privacy'])
      await expect(snapshot.read(`${id}:0:0`)).rejects.toMatchObject({ code: 'READ_FAILED' });
    expect(await snapshot.search('MFA')).toEqual([]);
    expect(JSON.stringify(await snapshot.search('30 days'))).not.toContain('Deleted customer workspaces');
    expect(snapshot.record.documents.find(d => d.id === 'continuity')!.disclosure).toBe('restricted');
    await expect(
      buildEvidenceSnapshot({
        runId: 'foreign',
        manifest,
        root: resolve(root, 'evidence'),
        runtimeRoot: resolve(root, 'runtime'),
        scope: { ...scope, organizationId: 'foreign' },
        asOf,
        context: context(),
      }),
    ).rejects.toMatchObject({ code: 'INVALID_MAPPING' });
    const wrongEnvironment = await buildEvidenceSnapshot({
      runId: 'wrong-environment',
      manifest,
      root: resolve(root, 'evidence'),
      runtimeRoot: resolve(root, 'runtime'),
      scope: { ...scope, environment: 'staging' },
      asOf,
      context: context(),
    });
    expect(wrongEnvironment.record.excerpts).toEqual([]);
    expect(wrongEnvironment.record.denied.every(d => d.reason === 'WRONG_SCOPE')).toBe(true);
    const futureApproval = structuredClone(manifest);
    futureApproval.documents[0]!.approvedAt = '2027-01-01T00:00:00.000Z';
    expect((await build(futureApproval, 'future-approval')).record.denied).toContainEqual({
      documentId: 'overview',
      citationLabel: 'Northstar overview v1',
      reason: 'NOT_VALID',
    });
    const normal = await build(manifest, 'fresh');
    await expect(
      validateSnapshotSources(normal.record, manifest, resolve(root, 'evidence'), context(), asOf),
    ).resolves.toBeUndefined();
    await writeFile(resolve(root, 'evidence', 'access.md'), 'Changed bytes');
    await expect(
      validateSnapshotSources(normal.record, manifest, resolve(root, 'evidence'), context(), asOf),
    ).rejects.toMatchObject({ code: 'SOURCE_CHANGED' });
    const changedPolicy = structuredClone(manifest);
    changedPolicy.documents[0]!.llmAllowed = false;
    await expect(
      validateSnapshotSources(normal.record, changedPolicy, resolve(root, 'evidence'), context(), asOf),
    ).rejects.toMatchObject({ code: 'SOURCE_CHANGED' });
    await expect(
      buildEvidenceSnapshot({
        runId: 'aggregate-limit',
        manifest,
        root: resolve(root, 'evidence'),
        runtimeRoot: resolve(root, 'runtime'),
        scope,
        asOf,
        context: context({ maxAggregateBytes: 1 }),
      }),
    ).rejects.toMatchObject({ code: 'LIMIT_EXCEEDED' });
    await expect(
      buildEvidenceSnapshot({
        runId: 'document-limit',
        manifest,
        root: resolve(root, 'evidence'),
        runtimeRoot: resolve(root, 'runtime'),
        scope,
        asOf,
        context: context({ maxEvidenceDocuments: 1 }),
      }),
    ).rejects.toMatchObject({ code: 'LIMIT_EXCEEDED' });
    const huge = resolve(root, 'huge-manifest.json');
    await writeFile(huge, ' '.repeat(1024 * 1024 + 1));
    await expect(loadManifest(huge)).rejects.toMatchObject({ code: 'LIMIT_EXCEEDED' });
  }, 60_000);
  it('blocks_workspace_escape_and_agent_source_mutation', async () => {
    const manifest = await generateCorpus(root),
      snapshot = await build(manifest);
    expect(snapshot).not.toHaveProperty('workspace');
    expect(snapshot).not.toHaveProperty('filesystem');
    expect(snapshot).not.toHaveProperty('index');
    expect(snapshot).not.toHaveProperty('executeCommand');
    await expect(snapshot.read('../access.md')).rejects.toMatchObject({ code: 'READ_FAILED' });
    await expect(snapshot.read('/etc/passwd')).rejects.toMatchObject({ code: 'READ_FAILED' });
    await expect(snapshot.search('MFA', 11)).rejects.toBeDefined();
    await expect(snapshot.search('x'.repeat(1001))).rejects.toBeDefined();
    const outside = resolve(root, 'outside-secret.md');
    await writeFile(outside, 'EXCLUDED_CANARY_TEXT');
    await symlink(outside, resolve(root, 'evidence', 'escape.md'));
    await expect(readSource('escape.md', 'escape', context().limits, resolve(root, 'evidence'))).rejects.toMatchObject({
      code: 'READ_FAILED',
    });
    await expect(
      readSource('../outside-secret.md', 'escape', context().limits, resolve(root, 'evidence')),
    ).rejects.toMatchObject({ code: 'READ_FAILED' });
    await expect(readSource(outside, 'escape', context().limits, resolve(root, 'evidence'))).rejects.toMatchObject({
      code: 'READ_FAILED',
    });
    const snapshotRoot = resolve(root, 'runtime', 'snapshots', `${snapshot.record.runId}-${snapshot.record.digest}`);
    const fs = new LocalFilesystem({ basePath: snapshotRoot, contained: true, readOnly: true });
    await fs.init();
    await expect(fs.writeFile('new.txt', 'unsafe')).rejects.toThrow();
    await expect(fs.deleteFile('excerpt-0.txt')).rejects.toThrow();
    await expect(fs.readFile(outside)).rejects.toThrow();
    const actualFiles = await readdir(snapshotRoot);
    expect(actualFiles.filter(f => f.endsWith('.txt'))).toHaveLength(snapshot.record.excerpts.length);
    expect((await lstat(snapshotRoot)).mode & 0o222).toBe(0);
    const uncontained = resolve(root, 'uncontained');
    await mkdir(uncontained);
    await symlink(outside, join(uncontained, 'escape.txt'));
    const containedFs = new LocalFilesystem({ basePath: uncontained, contained: true, readOnly: true });
    await containedFs.init();
    await expect(containedFs.readFile('escape.txt')).rejects.toThrow();
    const again = await build(manifest);
    expect(again.record.digest).toBe(snapshot.record.digest);
    expect(await again.search('MFA')).toEqual(await snapshot.search('MFA'));
    expect(await readFile(resolve(root, 'evidence', 'access.md'), 'utf8')).toContain('Workforce');
    const path = resolve(snapshotRoot, 'excerpt-0.txt');
    await chmod(path, 0o600);
    await writeFile(path, 'tampered snapshot');
    await expect(snapshot.read(snapshot.record.excerpts[0]!.id)).rejects.toMatchObject({ code: 'SOURCE_CHANGED' });
    await expect(build(manifest)).rejects.toMatchObject({ code: 'SOURCE_CHANGED' });
    expect(await readFile(outside, 'utf8')).toBe('EXCLUDED_CANARY_TEXT');
  }, 60_000);
  it('persists_immutable_evidence_sources_across_database_reopen_and_rejects_conflicts', async () => {
    const manifest = await generateCorpus(root),
      snapshot = await build(manifest);
    const url = `file:${resolve(root, 'persistent.db')}`;
    const store = await openIntakeStore(url);
    await store.persistEvidence(snapshot.record, snapshot.sources);
    await expect(store.persistEvidence(snapshot.record, snapshot.sources)).resolves.toBeUndefined();
    const altered = { ...snapshot.record, digest: '0'.repeat(64) };
    await expect(store.persistEvidence(altered, snapshot.sources)).rejects.toThrow('digest mismatch');
    await expect(
      store.persistEvidence({ ...snapshot.record, runId: 'incomplete' }, snapshot.sources.slice(1)),
    ).rejects.toThrow();
    store.close();
    const reopened = await openIntakeStore(url);
    try {
      expect(await reopened.readEvidence(snapshot.record.runId)).toEqual(snapshot.record);
      expect(await reopened.readEvidence('incomplete')).toBeUndefined();
      const changed = structuredClone(manifest);
      changed.documents[0]!.disclosure = 'restricted';
      const next = await build(changed);
      await expect(reopened.persistEvidence(next.record, next.sources)).rejects.toThrow('different evidence');
      expect(await reopened.readEvidence(snapshot.record.runId)).toEqual(snapshot.record);
    } finally {
      reopened.close();
    }
  }, 60_000);
  it('enforces_the_combined_questionnaire_and_evidence_original_byte_limit_in_both_orders', async () => {
    const manifest = await generateCorpus(root),
      snapshot = await build(manifest, 'combined');
    const questionnaire = source(
      xlsxFixture([
        {
          name: 'Review',
          rows: [
            ['ID', 'Prompt'],
            ['Q-1', 'Is MFA required?'],
          ],
        },
      ]),
    );
    const coordinator = new IntakeCoordinator();
    const mapping = tableMapping(
      questionnaire,
      [{ regionId: 'sheet:0', startRow: 1, endRow: 1, fields: { id: 0, question: 1 }, answerType: 'free_text' }],
      [{ regionId: 'sheet:0', startRow: 0, endRow: 0, reason: 'Header' }],
    );
    const imported = await coordinator.import(
      questionnaire,
      mapping,
      { questionnaireId: 'combined-review', organizationId: 'northstar', title: 'Review' },
      context(),
    );
    const total = snapshot.sources.reduce((sum, s) => sum + s.source.sizeBytes, questionnaire.sizeBytes);
    const limit = context({ maxAggregateBytes: total - 1 }).limits;
    const evidenceFirst = await openIntakeStore(`file:${resolve(root, 'evidence-first.db')}`, limit);
    try {
      await evidenceFirst.persistEvidence(snapshot.record, snapshot.sources);
      await expect(
        evidenceFirst.persistIntake('combined', imported.input, mapping, questionnaire),
      ).rejects.toMatchObject({ code: 'LIMIT_EXCEEDED' });
      expect(await evidenceFirst.readIntake('combined')).toBeUndefined();
      expect(await evidenceFirst.readEvidence('combined')).toEqual(snapshot.record);
    } finally {
      evidenceFirst.close();
    }
    const intakeFirst = await openIntakeStore(`file:${resolve(root, 'intake-first.db')}`, limit);
    try {
      await intakeFirst.persistIntake('combined', imported.input, mapping, questionnaire);
      await expect(intakeFirst.persistEvidence(snapshot.record, snapshot.sources)).rejects.toMatchObject({
        code: 'LIMIT_EXCEEDED',
      });
      expect(await intakeFirst.readEvidence('combined')).toBeUndefined();
      expect((await intakeFirst.readIntake('combined'))?.input).toEqual(imported.input);
    } finally {
      intakeFirst.close();
    }
  }, 60_000);
  it('rejects_unknown_or_incomplete_evidence_without_a_partial_snapshot', async () => {
    await mkdir(resolve(root, 'evidence'));
    const bytes = new TextEncoder().encode('Unrelated text pretending to be PDF');
    await writeFile(resolve(root, 'evidence', 'false.pdf'), bytes);
    const document: EvidenceDocument = {
      id: 'bad-pdf',
      relativePath: 'false.pdf',
      format: 'pdf',
      version: '1',
      sha256: sha256(bytes),
      title: 'PDF',
      citationLabel: 'PDF',
      scope: { organizationId: 'northstar', products: ['tasks'], environments: ['production'], domains: ['access'] },
      kind: 'policy',
      approvalState: 'approved',
      approvedBy: 'owner',
      approvedAt: '2026-09-01T00:00:00.000Z',
      validFrom: '2026-09-01T00:00:00.000Z',
      validUntil: '2027-09-01T00:00:00.000Z',
      llmAllowed: true,
      disclosure: 'shareable',
    };
    await expect(build({ schemaVersion: 1, organizationId: 'northstar', documents: [document] })).rejects.toMatchObject(
      { code: 'CORRUPT_FILE' },
    );
    await expect(
      readSource('missing.md', 'missing', context().limits, resolve(root, 'evidence')),
    ).rejects.toMatchObject({ code: 'READ_FAILED' });
    await expect(
      runParser(source(new TextEncoder().encode('a,b\n"unterminated'), 'invalid.csv'), 'csv', 'evidence', context()),
    ).rejects.toMatchObject({ code: 'PARSER_FAILED' });
    await expect(
      runParser(
        source(pdfFixture(['Page text'], { pageCount: 2 }), 'page-limit.pdf'),
        'pdf',
        'evidence',
        context({ maxPdfPages: 1 }),
      ),
    ).rejects.toMatchObject({ code: 'LIMIT_EXCEEDED' });
  }, 30_000);
});
