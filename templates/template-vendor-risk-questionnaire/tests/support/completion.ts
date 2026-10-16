import { IntakeCoordinator } from '../../src/mastra/intake/adapters.ts';
import { projectionSchema } from '../../src/mastra/contracts/review.ts';
import { xlsxFixture, docxFixture } from '../fixtures/office.ts';
import { source, context, operator, tableMapping } from '../fixtures/support.ts';
import { buildWritePlan } from '../../src/mastra/completion/plan.ts';

export async function documentFixture(format: 'xlsx' | 'docx', transform = (b: Uint8Array) => b, prefill = '') {
  const rows = [
    [
      'Reference',
      'Inquiry',
      'Response kind',
      'Allowed values',
      'Domain',
      'Guidance',
      'Buyer response',
      'Explanation',
      'Evidence',
    ],
    ['Q1', 'Describe workforce access controls.', 'free_text', '', 'access', 'Retain qualifications.', prefill, '', ''],
  ];
  const bytes = transform(
    format === 'xlsx' ? xlsxFixture([{ name: 'Questions', rows }]) : docxFixture([{ table: rows }]),
  );
  const snapshot = source(bytes, `input.${format}`),
    coordinator = new IntakeCoordinator();
  const inspection = await coordinator.inspect(snapshot, context());
  const mapping =
    inspection.mappingCandidates[0] ??
    tableMapping(
      snapshot,
      [
        {
          regionId: format === 'xlsx' ? 'sheet:0' : 'table:0',
          startRow: 1,
          endRow: 1,
          fields: {
            id: 0,
            question: 1,
            type: 2,
            options: 3,
            instructions: 5,
            response: 6,
            explanation: 7,
            evidence: 8,
          },
        },
      ],
      [{ regionId: format === 'xlsx' ? 'sheet:0' : 'table:0', startRow: 0, endRow: 0, reason: 'Header.' }],
    );
  const imported = await coordinator.import(snapshot, mapping, operator, context());
  const projection = projectionSchema.parse({
    schemaVersion: 1,
    runId: 'document-run',
    organizationId: 'northstar',
    revision: 1,
    approvalId: 'explicit-approval',
    evidenceDigest: 'a'.repeat(64),
    policyDigest: 'b'.repeat(64),
    quality: 'complete',
    total: 1,
    supported: 1,
    answers: [
      {
        questionId: 'Q1',
        order: 0,
        question: rows[1]![1],
        disposition: 'release',
        value: 'free_text',
        text: 'Workforce MFA is required. Enterprise SSO has a limited scope.',
        responseOption: null,
        limitations: ['Enterprise subscription scope only.'],
        safeReason: 'Supported by approved evidence.',
        citationIds: ['citation'],
      },
    ],
    evidence: [
      {
        id: 'citation',
        documentId: 'control',
        label: 'Approved access record',
        version: '1',
        sourceSha256: 'c'.repeat(64),
        locator: 'Heading Access; line 2',
        supportingExcerpt: 'Workforce MFA is required.',
      },
    ],
  });
  return {
    bytes,
    snapshot,
    ...imported,
    projection,
    plan: async (consent: string[] = []) => buildWritePlan(bytes, imported.input, mapping, consent),
  };
}
