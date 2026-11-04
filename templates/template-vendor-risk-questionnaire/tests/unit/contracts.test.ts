import { describe, it, expect } from 'vitest';
import { answerConstraintsSchema, questionSchema } from '../../src/mastra/contracts/question.ts';
import { questionnaireSchema } from '../../src/mastra/contracts/questionnaire.ts';
import { mappingSchema } from '../../src/mastra/contracts/mapping.ts';
import { coverageSchema, normalizationSchema } from '../../src/mastra/contracts/normalization.ts';
import { limitsSchema } from '../../src/mastra/contracts/limits.ts';
import { sourceLocatorSchema } from '../../src/mastra/contracts/source-locator.ts';
import { evidenceDocumentSchema, manifestSchema } from '../../src/mastra/contracts/evidence-manifest.ts';
import { evidenceCitationSchema } from '../../src/mastra/contracts/evidence-citation.ts';
import { evidenceSnapshotSchema } from '../../src/mastra/contracts/evidence-snapshot.ts';
import type { CanonicalQuestion } from '../../src/mastra/contracts/question.ts';
import type { EvidenceDocument } from '../../src/mastra/contracts/evidence-manifest.ts';
import { source, tableMapping } from '../fixtures/support.ts';

const hash = 'a'.repeat(64);
const locator = { kind: 'xlsx.cell' as const, sourceId: 'original', sourceSha256: hash, sheet: 'Inquiry', cell: 'B2' };
const question: CanonicalQuestion = {
  id: 'Q-1',
  originalText: ' Is MFA required?\nFor administrators. ',
  normalizedText: 'Is MFA required? For administrators.',
  order: 0,
  answerType: 'boolean',
  answerConstraints: {
    required: true,
    options: [
      { value: 'Yes', label: 'Yes' },
      { value: 'No', label: 'No' },
      { value: 'N/A', label: 'Not applicable' },
    ],
  },
  sourceLocators: [locator],
};
const document: EvidenceDocument = {
  id: 'policy',
  relativePath: 'policy.md',
  format: 'markdown',
  version: '1',
  sha256: hash,
  title: 'Private title',
  citationLabel: 'Approved policy',
  scope: { organizationId: 'northstar', products: ['tasks'], environments: ['production'], domains: ['access'] },
  kind: 'policy',
  approvalState: 'approved',
  approvedBy: 'security-owner',
  approvedAt: '2026-09-01T00:00:00.000Z',
  validFrom: '2026-09-01T00:00:00.000Z',
  validUntil: '2027-09-01T00:00:00.000Z',
  llmAllowed: true,
  disclosure: 'review_required',
};
const provenance = {
  sourceId: 'original',
  sourceSha256: hash,
  adapterKey: 'xlsx',
  adapterVersion: '1.0.0',
  contractVersion: 1 as const,
  profile: 'xlsx.table.v1',
  profileVersion: 1 as const,
  mappingDigest: 'b'.repeat(64),
};

describe('strict intake and evidence contracts', () => {
  it('preserves supplied option labels and rejects incompatible or duplicate constraints', () => {
    expect(questionSchema.parse(question).answerConstraints.options).toEqual(question.answerConstraints.options);
    expect(
      answerConstraintsSchema.safeParse({
        options: [
          { value: 'yes', label: 'First' },
          { value: 'yes', label: 'Second' },
        ],
      }).success,
    ).toBe(false);
    expect(answerConstraintsSchema.safeParse({ maxChars: 0 }).success).toBe(false);
    expect(questionSchema.safeParse({ ...question, answerType: 'single_choice', answerConstraints: {} }).success).toBe(
      false,
    );
    expect(questionSchema.safeParse({ ...question, answerType: 'free_text' }).success).toBe(false);
    expect(questionSchema.safeParse({ ...question, answerConstraints: {} }).success).toBe(false);
    expect(
      questionSchema.safeParse({
        ...question,
        answerConstraints: {
          options: [
            { value: 'red', label: 'Red' },
            { value: 'blue', label: 'Blue' },
          ],
        },
      }).success,
    ).toBe(false);
    expect(
      questionSchema.parse({
        ...question,
        answerType: 'single_choice',
        answerConstraints: {
          options: [
            { value: 'red', label: 'Red' },
            { value: 'blue', label: 'Blue' },
          ],
        },
      }).answerType,
    ).toBe('single_choice');
    for (const missing of ['id', 'originalText', 'answerType', 'answerConstraints', 'sourceLocators'])
      expect(questionSchema.safeParse({ ...question, [missing]: undefined }).success).toBe(false);
    expect(questionSchema.safeParse({ ...question, normalizedText: 'MFA is required.' }).success).toBe(false);
    expect(questionSchema.safeParse({ ...question, approved: true }).success).toBe(false);
  });
  it('requires unique contiguous question identities and original source bindings', () => {
    const valid = {
      schemaVersion: 1,
      questionnaireId: 'review',
      organizationId: 'northstar',
      title: 'Review',
      inputProvenance: provenance,
      questions: [question],
    };
    expect(questionnaireSchema.parse(valid).questions[0]!.originalText).toBe(question.originalText);
    expect(questionnaireSchema.safeParse({ ...valid, questions: [question, { ...question, order: 1 }] }).success).toBe(
      false,
    );
    expect(questionnaireSchema.safeParse({ ...valid, questions: [{ ...question, order: 2 }] }).success).toBe(false);
    expect(
      questionnaireSchema.safeParse({ ...valid, inputProvenance: { ...provenance, sourceId: 'foreign' } }).success,
    ).toBe(false);
    expect(
      questionnaireSchema.safeParse({
        ...valid,
        questions: [
          {
            ...question,
            responseTargets: [{ role: 'response', locator: { ...locator, sourceSha256: 'c'.repeat(64) } }],
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      normalizationSchema.safeParse({
        contractVersion: 1,
        status: 'ready',
        questions: [question, { ...question, order: 1 }],
        coverage: { discoveredCandidates: 2, emittedQuestions: 2, excludedCandidates: 0, excludedRegions: [] },
        diagnostics: [],
      }).success,
    ).toBe(false);
  });
  it('requires fresh strict mappings and complete accounted coverage', () => {
    const s = source(new Uint8Array([1]));
    const mapping = tableMapping(s, [{ regionId: 'sheet:0', startRow: 1, endRow: 3, fields: { question: 1, id: 0 } }]);
    expect(mappingSchema.parse(mapping)).toEqual(mapping);
    expect(
      mappingSchema.safeParse({ ...mapping, regions: [{ ...mapping.regions[0], fields: { question: 0, id: 0 } }] })
        .success,
    ).toBe(false);
    expect(
      mappingSchema.safeParse({ ...mapping, regions: [{ ...mapping.regions[0], startRow: 4, endRow: 1 }] }).success,
    ).toBe(false);
    expect(mappingSchema.safeParse({ ...mapping, regions: [mapping.regions[0], mapping.regions[0]] }).success).toBe(
      false,
    );
    expect(mappingSchema.safeParse({ ...mapping, selector: { path: 'arbitrary' } }).success).toBe(false);
    expect(
      coverageSchema.safeParse({
        discoveredCandidates: 3,
        emittedQuestions: 2,
        excludedCandidates: 0,
        excludedRegions: [],
      }).success,
    ).toBe(false);
    expect(
      coverageSchema.parse({
        discoveredCandidates: 3,
        emittedQuestions: 2,
        excludedCandidates: 1,
        excludedRegions: [{ regionId: 'sheet:0', startRow: 0, endRow: 0, reason: 'Header' }],
      }).excludedCandidates,
    ).toBe(1);
  });
  it('bounds every starter resource and rejects malformed structural locators', () => {
    for (const key of Object.keys(limitsSchema.parse({})))
      expect(limitsSchema.safeParse({ [key]: 0 }).success).toBe(false);
    expect(limitsSchema.safeParse({ timeoutMs: 1.5 }).success).toBe(false);
    expect(limitsSchema.safeParse({ maxPdfPages: 101 }).success).toBe(false);
    expect(limitsSchema.safeParse({ extra: 1 }).success).toBe(false);
    expect(sourceLocatorSchema.safeParse({ ...locator, cell: 'A0' }).success).toBe(false);
    expect(sourceLocatorSchema.safeParse({ ...locator, cell: '../A1' }).success).toBe(false);
    expect(sourceLocatorSchema.safeParse({ ...locator, sourceSha256: 'wrong' }).success).toBe(false);
    expect(
      sourceLocatorSchema.safeParse({
        kind: 'docx.table_cell',
        sourceId: 'original',
        sourceSha256: hash,
        part: 'word/document.xml',
        table: 0,
        row: -1,
        cell: 0,
      }).success,
    ).toBe(false);
  });
  it('keeps source approval transfer and disclosure metadata separate and fail-closed', () => {
    expect(
      evidenceDocumentSchema.parse({ ...document, llmAllowed: false, disclosure: 'restricted' }).approvalState,
    ).toBe('approved');
    for (const relativePath of ['../policy.md', '/etc/passwd', 'nested/../../policy.md', 'C:\\secret.md'])
      expect(evidenceDocumentSchema.safeParse({ ...document, relativePath }).success).toBe(false);
    expect(evidenceDocumentSchema.safeParse({ ...document, approvedBy: undefined }).success).toBe(false);
    expect(evidenceDocumentSchema.safeParse({ ...document, validUntil: document.validFrom }).success).toBe(false);
    expect(evidenceDocumentSchema.safeParse({ ...document, citationLabel: 'Confidential\nPath' }).success).toBe(false);
    expect(manifestSchema.safeParse({ schemaVersion: 1, organizationId: 'other', documents: [document] }).success).toBe(
      false,
    );
    expect(
      manifestSchema.safeParse({ schemaVersion: 1, organizationId: 'northstar', documents: [document, document] })
        .success,
    ).toBe(false);
  });
  it('binds citations and snapshots to approved original evidence identity', () => {
    const original = {
      kind: 'markdown.lines' as const,
      sourceId: document.id,
      sourceSha256: hash,
      heading: 'Access',
      startLine: 2,
      endLine: 2,
    };
    const citation = {
      id: 'citation',
      documentId: document.id,
      version: '1',
      sourceSha256: hash,
      locator: original,
      supportingExcerpt: 'MFA required',
    };
    expect(evidenceCitationSchema.parse(citation).locator).toEqual(original);
    expect(evidenceCitationSchema.safeParse({ ...citation, documentId: 'foreign' }).success).toBe(false);
    expect(evidenceCitationSchema.safeParse({ ...citation, locator: { ...original, endLine: 1 } }).success).toBe(false);
    const excerpt = {
      id: 'policy:0:0',
      documentId: 'policy',
      version: '1',
      sourceSha256: hash,
      citationLabel: document.citationLabel,
      kind: document.kind,
      disclosure: document.disclosure,
      locator: original,
      text: 'MFA required',
    };
    const snapshot = {
      schemaVersion: 1,
      runId: 'run',
      digest: hash,
      manifestDigest: hash,
      scope: { organizationId: 'northstar', product: 'tasks', environment: 'production', domains: ['access'] },
      asOf: '2026-10-01T00:00:00.000Z',
      documents: [document],
      excerpts: [excerpt],
      denied: [],
    };
    expect(evidenceSnapshotSchema.parse(snapshot).documents).toHaveLength(1);
    expect(
      evidenceSnapshotSchema.safeParse({ ...snapshot, documents: [{ ...document, llmAllowed: false }] }).success,
    ).toBe(false);
    expect(
      evidenceSnapshotSchema.safeParse({ ...snapshot, excerpts: [{ ...excerpt, version: 'other' }] }).success,
    ).toBe(false);
    expect(
      evidenceSnapshotSchema.safeParse({
        ...snapshot,
        documents: [{ ...document, scope: { ...document.scope, products: ['foreign'] } }],
      }).success,
    ).toBe(false);
  });
});
