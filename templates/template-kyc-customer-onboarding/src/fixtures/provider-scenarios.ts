import { createHash } from 'node:crypto';

import { applicationDataSchema, type ApplicationData } from '../domain/application.js';
import { extractedIdentitySchema, type DocumentType, type ExtractedIdentity } from '../domain/documents.js';
import { deepFreeze } from '../domain/immutable.js';

const encode = (value: string): Uint8Array<ArrayBuffer> => new Uint8Array(new TextEncoder().encode(value));
const byteLength = (value: string): number => encode(value).byteLength;
const escapePdfText = (value: string): string =>
  value.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');

const buildSyntheticPdf = (lines: readonly string[]): Uint8Array<ArrayBuffer> => {
  const content = [
    'BT',
    '/F1 11 Tf',
    '50 750 Td',
    ...lines.flatMap((line, index) =>
      index === 0 ? [`(${escapePdfText(line)}) Tj`] : ['0 -18 Td', `(${escapePdfText(line)}) Tj`],
    ),
    'ET',
  ].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${String(byteLength(content))} >>\nstream\n${content}\nendstream`,
  ];
  let body = '%PDF-1.4\n%synthetic\n';
  const offsets: number[] = [];
  for (const [index, object] of objects.entries()) {
    offsets.push(byteLength(body));
    body += `${String(index + 1)} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = byteLength(body);
  const xref = offsets.map(offset => `${String(offset).padStart(10, '0')} 00000 n `).join('\n');
  return encode(
    `${body}xref\n0 ${String(objects.length + 1)}\n0000000000 65535 f \n${xref}\ntrailer\n<< /Size ${String(objects.length + 1)} /Root 1 0 R >>\nstartxref\n${String(xrefOffset)}\n%%EOF\n`,
  );
};

const field = (originalValue: string | null, confidence: number | null = originalValue === null ? null : 1) => ({
  originalValue,
  normalizedValue: originalValue?.toUpperCase() ?? null,
  confidence,
  page: originalValue === null ? null : 1,
  evidenceText: originalValue,
});

const lowRiskIdentity = deepFreeze(
  extractedIdentitySchema.parse({
    fullName: field('Morgan Example'),
    dateOfBirth: field('1990-01-01'),
    documentNumber: field('SYNTHETIC-001'),
    expirationDate: field('2030-01-01'),
    nationality: field('US'),
    residentialAddress: field('100 Example Avenue, Sample City, NY 10001'),
  }),
);

const missingFieldsIdentity = deepFreeze(
  extractedIdentitySchema.parse({
    ...lowRiskIdentity,
    expirationDate: field(null),
  }),
);

const unreadableIdentity = deepFreeze(
  extractedIdentitySchema.parse({
    fullName: field(null),
    dateOfBirth: field(null),
    documentNumber: field(null),
    expirationDate: field(null),
    nationality: field(null),
    residentialAddress: field(null),
  }),
);

const identityWith = (fullName: string, residentialAddress = '100 Example Avenue, Sample City, NY 10001') =>
  deepFreeze(
    extractedIdentitySchema.parse({
      ...lowRiskIdentity,
      fullName: field(fullName),
      residentialAddress: field(residentialAddress),
    }),
  );

export const fixtureApplication: ApplicationData = applicationDataSchema.parse({
  fullName: 'Morgan Example',
  dateOfBirth: '1990-01-01',
  nationality: 'US',
  email: 'morgan@example.invalid',
  phone: '+1-202-555-0100',
  residentialAddress: {
    line1: '100 Example Avenue',
    city: 'Sample City',
    region: 'NY',
    postalCode: '10001',
    country: 'US',
  },
});

export type FixtureScenarioId =
  | 'low-risk'
  | 'missing-fields'
  | 'unreadable'
  | 'expired-document'
  | 'missing-document-side'
  | 'identity-mismatch'
  | 'dob-mismatch'
  | 'address-mismatch'
  | 'address-inconclusive'
  | 'sanctions-strong'
  | 'sanctions-ambiguous'
  | 'pep-candidate'
  | 'provider-unavailable'
  | 'high-risk-escalation';

export const fixtureScenarioIds = Object.freeze([
  'low-risk',
  'missing-fields',
  'unreadable',
] as const satisfies readonly FixtureScenarioId[]);

const allFixtureScenarioIds = Object.freeze([
  ...fixtureScenarioIds,
  'identity-mismatch',
  'expired-document',
  'missing-document-side',
  'dob-mismatch',
  'address-mismatch',
  'address-inconclusive',
  'sanctions-strong',
  'sanctions-ambiguous',
  'pep-candidate',
  'provider-unavailable',
  'high-risk-escalation',
] as const satisfies readonly FixtureScenarioId[]);

export type FixtureScenario = Readonly<{
  id: FixtureScenarioId;
  documentType: Exclude<DocumentType, 'UNKNOWN'>;
  mimeType: 'application/pdf';
  bytes: Uint8Array<ArrayBuffer>;
  application: ApplicationData;
  extraction: Readonly<{
    fields: ExtractedIdentity;
    quality: 'READABLE' | 'LOW_QUALITY' | 'UNREADABLE';
    missingFields: string[];
    warnings: string[];
  }>;
  digest: string;
}>;

const createScenario = (
  id: FixtureScenarioId,
  lines: readonly string[],
  extraction: FixtureScenario['extraction'],
  application: ApplicationData = fixtureApplication,
  documentType: Exclude<DocumentType, 'UNKNOWN'> = 'PASSPORT',
): FixtureScenario => {
  const bytes = buildSyntheticPdf(lines);
  return Object.freeze({
    id,
    documentType,
    mimeType: 'application/pdf',
    bytes,
    application,
    extraction,
    digest: createHash('sha256').update(bytes).digest('hex'),
  });
};

const scenarios = Object.freeze({
  'low-risk': createScenario(
    'low-risk',
    [
      'SYNTHETIC DEMONSTRATION PASSPORT - NOT A REAL IDENTITY DOCUMENT',
      'Name: Morgan Example',
      'Date of birth: 1990-01-01',
      'Document number: SYNTHETIC-001',
      'Expiration date: 2030-01-01',
      'Nationality: US',
      'Residential address: 100 Example Avenue, Sample City, NY 10001',
    ],
    { fields: lowRiskIdentity, quality: 'READABLE', missingFields: [], warnings: [] },
  ),
  'missing-fields': createScenario(
    'missing-fields',
    [
      'SYNTHETIC DEMONSTRATION PASSPORT - NOT A REAL IDENTITY DOCUMENT',
      'Name: Morgan Example',
      'Date of birth: 1990-01-01',
      'Document number: SYNTHETIC-002',
      'Expiration date: MISSING',
      'Nationality: US',
    ],
    {
      fields: missingFieldsIdentity,
      quality: 'READABLE',
      missingFields: ['expirationDate'],
      warnings: ['A required field is absent from the synthetic document'],
    },
  ),
  unreadable: createScenario(
    'unreadable',
    [
      'SYNTHETIC DEMONSTRATION PASSPORT - NOT A REAL IDENTITY DOCUMENT',
      'The remaining synthetic content is intentionally unreadable.',
    ],
    {
      fields: unreadableIdentity,
      quality: 'UNREADABLE',
      missingFields: ['fullName', 'dateOfBirth', 'documentNumber', 'expirationDate'],
      warnings: ['The synthetic document is unreadable'],
    },
  ),
  'expired-document': createScenario(
    'expired-document',
    ['SYNTHETIC DEMONSTRATION PASSPORT - EXPIRED TEST FIXTURE', 'Name: Morgan Example', 'Expiration date: 2020-01-01'],
    {
      fields: deepFreeze(extractedIdentitySchema.parse({ ...lowRiskIdentity, expirationDate: field('2020-01-01') })),
      quality: 'READABLE',
      missingFields: [],
      warnings: ['The synthetic document carries an expired date for extraction evaluation'],
    },
  ),
  'missing-document-side': createScenario(
    'missing-document-side',
    ['SYNTHETIC DEMONSTRATION ID - FRONT SIDE ONLY'],
    {
      fields: lowRiskIdentity,
      quality: 'READABLE',
      missingFields: ['documentSide'],
      warnings: ['The required synthetic reverse side is absent'],
    },
    fixtureApplication,
    'DRIVERS_LICENSE',
  ),
  'identity-mismatch': createScenario(
    'identity-mismatch',
    ['SYNTHETIC DEMONSTRATION PASSPORT', 'Name: Morgan Example'],
    { fields: lowRiskIdentity, quality: 'READABLE', missingFields: [], warnings: [] },
    applicationDataSchema.parse({ ...fixtureApplication, fullName: 'Morgan Mismatch' }),
  ),
  'dob-mismatch': createScenario(
    'dob-mismatch',
    ['SYNTHETIC DEMONSTRATION PASSPORT', 'Date of birth: 1990-01-01'],
    { fields: lowRiskIdentity, quality: 'READABLE', missingFields: [], warnings: [] },
    applicationDataSchema.parse({ ...fixtureApplication, dateOfBirth: '1991-01-01' }),
  ),
  'address-mismatch': createScenario(
    'address-mismatch',
    ['SYNTHETIC DEMONSTRATION PASSPORT', 'Address: 200 Different Road'],
    {
      fields: identityWith('Morgan Example', '200 Different Road, Other City, CA 90001'),
      quality: 'READABLE',
      missingFields: [],
      warnings: [],
    },
  ),
  'address-inconclusive': createScenario(
    'address-inconclusive',
    ['SYNTHETIC DEMONSTRATION PASSPORT', 'Name: Morgan Example', 'Address: NOT PRESENT'],
    {
      fields: identityWith('Morgan Example', ''),
      quality: 'READABLE',
      missingFields: ['residentialAddress'],
      warnings: ['The synthetic address is absent'],
    },
  ),
  'sanctions-strong': createScenario(
    'sanctions-strong',
    ['SYNTHETIC DEMONSTRATION PASSPORT', 'Name: Morgan Sanctions Strong'],
    {
      fields: identityWith('Morgan Sanctions Strong'),
      quality: 'READABLE',
      missingFields: [],
      warnings: [],
    },
    applicationDataSchema.parse({ ...fixtureApplication, fullName: 'Morgan Sanctions Strong' }),
  ),
  'sanctions-ambiguous': createScenario(
    'sanctions-ambiguous',
    ['SYNTHETIC DEMONSTRATION PASSPORT', 'Name: Morgan Sanctions Candidate'],
    {
      fields: identityWith('Morgan Sanctions Candidate'),
      quality: 'READABLE',
      missingFields: [],
      warnings: [],
    },
    applicationDataSchema.parse({ ...fixtureApplication, fullName: 'Morgan Sanctions Candidate' }),
  ),
  'pep-candidate': createScenario(
    'pep-candidate',
    ['SYNTHETIC DEMONSTRATION PASSPORT', 'Name: Morgan PEP Candidate'],
    {
      fields: identityWith('Morgan PEP Candidate'),
      quality: 'READABLE',
      missingFields: [],
      warnings: [],
    },
    applicationDataSchema.parse({ ...fixtureApplication, fullName: 'Morgan PEP Candidate' }),
  ),
  'provider-unavailable': createScenario(
    'provider-unavailable',
    ['SYNTHETIC DEMONSTRATION PASSPORT', 'Name: Morgan Error'],
    {
      fields: identityWith('Morgan Error'),
      quality: 'READABLE',
      missingFields: [],
      warnings: [],
    },
    applicationDataSchema.parse({ ...fixtureApplication, fullName: 'Morgan Error' }),
  ),
  'high-risk-escalation': createScenario(
    'high-risk-escalation',
    ['SYNTHETIC DEMONSTRATION PASSPORT', 'Name: Morgan Sanctions Candidate PEP Candidate'],
    {
      fields: identityWith('Morgan Sanctions Candidate PEP Candidate'),
      quality: 'READABLE',
      missingFields: [],
      warnings: [],
    },
    applicationDataSchema.parse({
      ...fixtureApplication,
      fullName: 'Morgan Sanctions Candidate PEP Candidate',
    }),
  ),
}) satisfies Readonly<Record<FixtureScenarioId, FixtureScenario>>;

export const fixtureExtractedIdentity: ExtractedIdentity = lowRiskIdentity;

export const fixtureDigests = Object.freeze({
  readable: scenarios['low-risk'].digest,
  missingFields: scenarios['missing-fields'].digest,
  unreadable: scenarios.unreadable.digest,
  invalid: '3'.repeat(64),
});

export const getFixtureScenario = (id: FixtureScenarioId): FixtureScenario => ({
  ...scenarios[id],
  bytes: new Uint8Array(scenarios[id].bytes),
  application: applicationDataSchema.parse(scenarios[id].application),
});

export const getFixtureScenarioByDigest = (digest: string): FixtureScenario | undefined => {
  const scenarioId = allFixtureScenarioIds.find(id => scenarios[id].digest === digest);
  return scenarioId === undefined ? undefined : getFixtureScenario(scenarioId);
};
