import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { sourcePassages, materializeExtraction } from '../../src/mastra/research/source-passages';
import type { Evidence } from '../../src/mastra/research/contracts';

function source(excerpt: string, id = 'source'): Evidence {
  return {
    id,
    excerpt,
    digest: createHash('sha256').update(excerpt).digest('hex'),
    kind: 'website',
    source: 'https://example.com/about',
    providerId: 'openai-web',
    title: 'About',
    retrievedAt: '2026-10-19T00:00:00Z',
    publishedAt: null,
    retrieval: 'page',
  };
}
const base = { companyName: null, identityAmbiguous: false, intentCoverageComplete: false };
describe('identified literal source passages', () => {
  it('covers_long_rosters_tail_and_unicode_with_stable_source_digest_slice_bindings', () => {
    const evidence = source(('Member 🔒 ação\r\n'.repeat(1300) + 'Our headquarters: France.').slice(0, 24000));
    const passages = sourcePassages([evidence]);
    expect(passages).toEqual(sourcePassages([evidence]));
    const covered = new Set<number>();
    for (const passage of passages) {
      expect(passage.quote).toBe(evidence.excerpt.slice(passage.start, passage.end));
      expect(passage.quote.length).toBeLessThanOrEqual(2000);
      expect(passage.quote).not.toMatch(/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/);
      for (let i = passage.start; i < passage.end; i++) covered.add(i);
    }
    expect(covered.size).toBe(evidence.excerpt.length);
    expect(passages.at(-1)!.end).toBe(evidence.excerpt.length);
    expect(sourcePassages([{ ...evidence, id: 'other' }])[0]!.id).not.toBe(passages[0]!.id);
    expect(sourcePassages([source(evidence.excerpt + '!')])[0]!.id).not.toBe(passages[0]!.id);
  });
  it('materializes_main_and_additional_citations_without_model_recopied_text', () => {
    const passages = sourcePassages([
      source('Published team includes several staff.'),
      source('There may be additional unlisted employees.', 'other'),
    ]);
    const candidate = {
      id: 'estimate',
      attribute: 'employeeCount',
      value: { min: 3, max: 8 },
      asOf: null,
      passageId: passages[0]!.id,
      inference: {
        rationale: 'Published staff are a partial roster; unlisted staff may exist, so the upper bound is uncertain.',
        additionalPassageIds: [passages[1]!.id],
      },
    };
    const result = materializeExtraction({ ...base, candidates: [candidate] }, passages);
    expect(result.candidates[0]).toMatchObject({
      quote: passages[0]!.quote,
      evidenceId: 'source',
      inference: {
        rationale: candidate.inference.rationale,
        additionalPassages: [{ evidenceId: 'other', quote: passages[1]!.quote }],
      },
    });
    for (const [change, code] of [
      [{ passageId: `passage-${'0'.repeat(40)}` }, 'provider_passage_unknown'],
      [
        { inference: { ...candidate.inference, additionalPassageIds: [passages[0]!.id] } },
        'provider_passage_duplicate',
      ],
      [{ value: { min: 8, max: 3 } }, 'provider_passage_selection_invalid'],
    ] as const) {
      expect(() => materializeExtraction({ ...base, candidates: [{ ...candidate, ...change }] }, passages)).toThrow(
        expect.objectContaining({ code }),
      );
    }
    expect(() => materializeExtraction({ ...base, candidates: [candidate, candidate] }, passages)).toThrow(
      expect.objectContaining({ code: 'provider_passage_selection_invalid' }),
    );
    expect(() =>
      materializeExtraction(
        { ...base, candidates: [candidate] },
        passages.map(passage => ({ ...passage, quote: 'x'.repeat(2001) })),
      ),
    ).toThrow(expect.objectContaining({ code: 'provider_passage_materialization_invalid' }));
  });
});
