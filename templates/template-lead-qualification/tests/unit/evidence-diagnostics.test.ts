import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { candidateRejectionSchema, rejectedEvidenceDiagnosticSchema } from '../../src/mastra/research/contracts';
import type { Candidate, Evidence } from '../../src/mastra/research/contracts';
import { validateCandidates } from '../../src/mastra/research/evidence-validation';
import { diagnosticTextLimit } from '../../src/mastra/research/evidence-diagnostics';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
function source(excerpt: string, kind: Evidence['kind'] = 'website'): Evidence {
  return {
    id: kind,
    kind,
    source: 'https://example.com/about?credential=private-marker#private-marker',
    title: 'Controlled public evidence',
    excerpt,
    digest: digest(excerpt),
    providerId: 'records',
    retrievedAt: '2026-10-19T00:00:00Z',
    publishedAt: null,
    retrieval: kind === 'website' ? 'api' : 'submitted',
  };
}
function validate(
  quote: string,
  excerpt: string,
  options: {
    privateText?: string;
    supported?: boolean;
    kind?: Evidence['kind'];
    rationale?: string;
    additional?: number;
  } = {},
) {
  const evidence = source(excerpt, options.kind);
  const candidate: Candidate = {
    id: 'business',
    attribute: 'businessModel',
    value: 'b2b_saas',
    evidenceId: evidence.id,
    quote,
    asOf: null,
    ...(options.rationale
      ? {
          inference: {
            rationale: options.rationale,
            additionalPassages: Array.from({ length: options.additional ?? 0 }, (_, index) => ({
              evidenceId: `extra-${index}`,
              quote,
            })),
          },
        }
      : {}),
  };
  const material = [
    evidence,
    ...Array.from({ length: options.additional ?? 0 }, (_, index) => ({ ...evidence, id: `extra-${index}` })),
    ...(options.privateText ? [source(options.privateText, 'submitted')] : []),
  ];
  return validateCandidates(
    [candidate],
    options.supported ? [candidate.id] : [],
    {
      material,
      aliases: new Map(material.map(item => [item.id, `evidence-${digest(item.id).slice(0, 40)}`])),
    },
    { providerId: 'records', branch: 'firmographics', roundIndex: 0, businessModelLabels: ['b2b_saas'] },
  );
}

describe('bounded rejected public evidence diagnostics', () => {
  it('distinguishes_literal_semantic_and_normalization_mismatches_without_accepting_invalid_quotes', () => {
    const cases = [
      { quote: 'business cloud', excerpt: 'business\ncloud', matches: [true, true, true] },
      { quote: 'café software', excerpt: 'cafe\u0301 software', matches: [false, true, true] },
      { quote: "Company's software", excerpt: 'Company’s software', matches: [false, false, true] },
      { quote: 'invented private quotation', excerpt: 'business software', matches: [false, false, false] },
    ];
    for (const item of cases) {
      const rejected = validate(item.quote, item.excerpt, { supported: true });
      expect(rejected.candidates).toEqual([]);
      const rejection = candidateRejectionSchema.parse(rejected.rejections[0]);
      expect(rejection).toMatchObject({
        reason: 'exact_quote_absent',
        checks: { semanticSupported: true, exactQuotePresent: false },
      });
      const passage = rejection.diagnostic!.passages[0]!;
      expect([
        passage.whitespaceNormalizedMatch,
        passage.unicodeNormalizedMatch,
        passage.typographyNormalizedMatch,
      ]).toEqual(item.matches);
      expect(passage.quote).toEqual({
        digest: digest(item.quote),
        length: item.quote.length,
        publicText: null,
        omission: 'not_public_literal',
      });
      expect(passage.evidenceDigest).toBe(digest(item.excerpt));
      expect(JSON.stringify(rejection)).not.toContain('private-marker');
      expect(JSON.stringify(rejection)).not.toContain('invented private quotation');
    }
    const semantic = validate('business software', 'business software');
    expect(semantic.rejections[0]).toMatchObject({
      reason: 'semantic_verification_rejected',
      checks: { exactQuotePresent: true, semanticSupported: false },
      diagnostic: { passages: [{ quote: { publicText: 'business software', omission: null } }] },
    });
    const accepted = validate('business software', 'business software', { supported: true });
    expect(accepted.rejections).toEqual([]);
    expect(accepted.candidates[0]).toMatchObject({ quote: 'business software', value: 'b2b_saas' });
  });

  it('omits_unknown_private_credentials_urls_controls_and_inquiry_echoes_including_beyond_the_text_cap', () => {
    for (const kind of ['submitted', 'crm'] as const)
      expect(validate('private words', 'private words', { kind }).rejections[0]!.diagnostic).toBeUndefined();
    for (const sensitive of [
      'Authorization: Bearer private-marker',
      'api_key=private-marker',
      'password: private-marker',
      'buyer@private.example',
      'https://user:private-marker@example.com/about?key=private-marker#private-marker',
      'ftp://user:private-marker@example.com/report',
      'example.com/about?private-marker',
      'example.com/about#private-marker',
      'sk-test-private-marker',
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJwcml2YXRlIn0.signature',
      'public\u0000private-marker',
      'public\nprivate-marker',
      'company '.repeat(70) + 'token=private-marker',
    ]) {
      const rejection = candidateRejectionSchema.parse(validate(sensitive, sensitive).rejections[0]);
      expect(rejection.diagnostic!.passages[0]!.quote).toMatchObject({
        publicText: null,
        omission: 'sensitive_content',
      });
      expect(JSON.stringify(rejection)).not.toContain('private-marker');
    }
    const echo = 'Confidential procurement campaign';
    const rejection = validate(echo, echo, {
      privateText: 'Please discuss our confidential procurement campaign.',
      rationale: 'Private unrelated rationale',
    }).rejections[0]!;
    expect(rejection.diagnostic!.passages[0]!.quote).toMatchObject({ publicText: null, omission: 'private_overlap' });
    expect(rejection.diagnostic!.rationale).toMatchObject({ publicText: null, omission: 'not_public_literal' });
    expect(JSON.stringify(rejection)).not.toContain(echo);
    expect(JSON.stringify(rejection)).not.toContain('Private unrelated rationale');
    const unknown = validateCandidates(
      [
        {
          id: 'unknown',
          attribute: 'businessModel',
          value: 'b2b_saas',
          quote: echo,
          evidenceId: 'private-unknown-evidence-id',
          asOf: null,
        },
      ],
      [],
      { material: [], aliases: new Map() },
      { providerId: 'records', branch: 'firmographics', roundIndex: 0, businessModelLabels: ['b2b_saas'] },
    );
    expect(unknown.rejections[0]!.diagnostic).toBeUndefined();
    expect(JSON.stringify(unknown)).not.toContain('private-unknown-evidence-id');
    expect(JSON.stringify(unknown)).not.toContain(echo);
  });

  it('bounds_all_passages_text_and_record_size_and_rejects_unsafe_persisted_diagnostics', () => {
    const quote = '"\\'.repeat(1000);
    const diagnostic = validate(quote, quote, { rationale: quote, additional: 3 }).rejections[0]!.diagnostic!;
    expect(rejectedEvidenceDiagnosticSchema.parse(diagnostic)).toEqual(diagnostic);
    expect(diagnostic.passages).toHaveLength(4);
    expect(diagnostic.passages.every(passage => passage.quote.publicText?.length === diagnosticTextLimit)).toBe(true);
    expect(diagnostic.rationale!.publicText).toHaveLength(diagnosticTextLimit);
    expect(JSON.stringify(diagnostic).length).toBeLessThanOrEqual(4096);
    for (const invalid of [
      { ...diagnostic, version: 2 },
      { ...diagnostic, passages: [...diagnostic.passages, diagnostic.passages[0]] },
      { ...diagnostic, rationale: { ...diagnostic.rationale, publicText: 'x'.repeat(321) } },
      { ...diagnostic, rationale: { ...diagnostic.rationale, publicText: 'Authorization: private-marker' } },
      { ...diagnostic, rationale: { ...diagnostic.rationale, publicText: null, omission: null } },
      { ...diagnostic, rationale: { ...diagnostic.rationale, length: 2001 } },
    ])
      expect(rejectedEvidenceDiagnosticSchema.safeParse(invalid).success).toBe(false);
  });
});
