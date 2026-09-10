import { describe, expect, it } from 'vitest';

import {
  CANDIDATE_CONTEXT_MAX_CHARACTERS,
  projectCandidateContext,
  projectCandidateEntries,
  renderCandidateProjection,
} from '../subconscious/candidate-context';

const source = (id: string, text: string) => ({ type: 'record' as const, id, text });

/** Pads accumulated observations past the budget so the projection filters instead of forwarding. */
function overBudget(...lines: string[]) {
  const filler = Array.from(
    { length: 120 },
    (_, index) => `Unrelated accumulated observation ${index} about scheduling, travel, and errands.`,
  );
  const all = [...lines, ...filler].join('\n');
  expect(all.length).toBeGreaterThan(CANDIDATE_CONTEXT_MAX_CHARACTERS);
  return all;
}

describe('candidate context projection', () => {
  it('reports, per candidate, the accumulated observations that reference it', () => {
    const activeObservations = overBudget(
      'Jamie switched the invoice pipeline to quarterly billing.',
      'The kitchen renovation is blocked on the countertop supplier.',
      'Tyler prefers reviews posted before standup.',
    );

    const result = projectCandidateContext({
      activeObservations,
      sources: [source('k-invoice', 'invoice pipeline billing cadence')],
    });

    expect(result).toContain('k-invoice');
    expect(result).toContain('invoice pipeline to quarterly billing');
    // unrelated accumulated observations are not carried along
    expect(result).not.toContain('countertop supplier');
    expect(result).not.toContain('before standup');
  });

  it('says plainly when nothing accumulated references a candidate, without claiming it was forgotten', () => {
    const result = projectCandidateContext({
      activeObservations: overBudget('The kitchen renovation is blocked on the countertop supplier.'),
      sources: [source('k-invoice', 'invoice pipeline billing cadence')],
    });

    expect(result).toContain('k-invoice');
    expect(result).toMatch(/no accumulated observation references/i);
    // must never assert the parent forgot it — absence of a lexical match is not absence of knowledge
    expect(result).not.toMatch(/forgot|no longer knows|not in context/i);
  });

  it('attributes each excerpt to the candidate it matched rather than merging them', () => {
    const activeObservations = overBudget(
      'Jamie switched the invoice pipeline to quarterly billing.',
      'The kitchen renovation is blocked on the countertop supplier.',
    );

    const result = projectCandidateContext({
      activeObservations,
      sources: [source('k-invoice', 'invoice pipeline billing'), source('k-kitchen', 'kitchen renovation countertop')],
    });

    const invoiceAt = result.indexOf('k-invoice');
    const kitchenAt = result.indexOf('k-kitchen');
    expect(invoiceAt).toBeGreaterThanOrEqual(0);
    expect(kitchenAt).toBeGreaterThan(invoiceAt);
    expect(result.slice(invoiceAt, kitchenAt)).toContain('quarterly billing');
    expect(result.slice(invoiceAt, kitchenAt)).not.toContain('countertop');
    expect(result.slice(kitchenAt)).toContain('countertop supplier');
  });

  it('stays under a fixed maximum regardless of how large the accumulated observations are', () => {
    const activeObservations = Array.from(
      { length: 5_000 },
      (_, index) => `Observation ${index} about the invoice pipeline and its billing cadence.`,
    ).join('\n');

    const result = projectCandidateContext({
      activeObservations,
      sources: [source('k-invoice', 'invoice pipeline billing cadence')],
    });

    expect(result.length).toBeLessThanOrEqual(CANDIDATE_CONTEXT_MAX_CHARACTERS);
    expect(result).toContain('[omitted');
  });

  it('is smaller than shipping the whole accumulated blob when only part of it is relevant', () => {
    const activeObservations = [
      'Jamie switched the invoice pipeline to quarterly billing.',
      ...Array.from({ length: 500 }, (_, index) => `Unrelated observation ${index} about gardening schedules.`),
    ].join('\n');

    const result = projectCandidateContext({
      activeObservations,
      sources: [source('k-invoice', 'invoice pipeline billing')],
    });

    expect(result.length).toBeLessThan(activeObservations.length / 4);
  });

  it('treats a candidate with no distinctive terms as unmatched rather than matching everything', () => {
    const activeObservations = overBudget('Jamie switched the invoice pipeline to quarterly billing.');

    const result = projectCandidateContext({
      activeObservations,
      sources: [source('k-vague', 'the that with what')],
    });

    expect(result).toMatch(/no accumulated observation references/i);
    expect(result).not.toContain('quarterly billing');
  });

  it('returns an explicit empty-state when there are no accumulated observations at all', () => {
    const result = projectCandidateContext({
      activeObservations: '',
      sources: [source('k-invoice', 'invoice pipeline billing')],
    });

    expect(result).toMatch(/no accumulated observations/i);
  });

  it('forwards the whole accumulated memory while it still fits in the budget', () => {
    // Filtering only exists to control size. Under the budget it would cost recall for nothing:
    // a fact worded entirely differently from the candidate is invisible to a lexical join, but a
    // model reading the whole memory can still spot it.
    const activeObservations = [
      'Jamie moved the invoice pipeline to a quarterly billing cadence.',
      'Tyler prefers reviews posted before standup.',
    ].join('\n');

    const result = projectCandidateContext({
      activeObservations,
      sources: [source('k-cash', 'cash collection rhythm changed')],
    });

    expect(result.length).toBeLessThanOrEqual(CANDIDATE_CONTEXT_MAX_CHARACTERS + 64);
    // shares no distinctive term with the candidate, yet is still forwarded
    expect(result).toContain('quarterly billing cadence');
    expect(result).toContain('before standup');
  });
});

describe('candidate context entries', () => {
  const sources = [
    source('k-invoice', 'invoice pipeline billing cadence'),
    source('k-kitchen', 'kitchen renovation countertop'),
  ];

  it('reports the passthrough regime, with no per-candidate identity to key on, while under the budget', () => {
    const projection = projectCandidateEntries({
      activeObservations: 'Jamie moved the invoice pipeline to a quarterly billing cadence.',
      sources,
    });

    expect(projection.regime).toBe('passthrough');
    expect(projection).not.toHaveProperty('entries');
  });

  it('gives every candidate exactly one entry once the projection filters, unmatched candidates included', () => {
    const projection = projectCandidateEntries({
      activeObservations: overBudget('Jamie switched the invoice pipeline to quarterly billing.'),
      sources,
    });

    expect(projection.regime).toBe('filtered');
    if (projection.regime !== 'filtered') throw new Error('expected the filtered regime');

    expect(projection.entries.map(entry => entry.id)).toEqual(['k-invoice', 'k-kitchen']);
    expect(projection.entries[0]!.excerpt).toContain('quarterly billing');
    // the unmatched candidate keeps its own entry, and its excerpt stays a wording-overlap caveat
    expect(projection.entries[1]!.excerpt).toContain('no accumulated observation references it by wording');
    expect(projection.entries[1]!.excerpt).toContain('is not evidence about what the parent still holds');
  });

  it('switches regime at the budget boundary, not near it', () => {
    const atBudget = 'x'.repeat(CANDIDATE_CONTEXT_MAX_CHARACTERS);
    const overByOne = 'x'.repeat(CANDIDATE_CONTEXT_MAX_CHARACTERS + 1);

    expect(projectCandidateEntries({ activeObservations: atBudget, sources }).regime).toBe('passthrough');
    expect(projectCandidateEntries({ activeObservations: overByOne, sources }).regime).toBe('filtered');
  });

  it('renders byte-identically to the projection callers already ship, in both regimes', () => {
    for (const activeObservations of [
      '',
      'Jamie moved the invoice pipeline to a quarterly billing cadence.',
      overBudget('Jamie switched the invoice pipeline to quarterly billing.'),
      Array.from(
        { length: 5_000 },
        (_, index) => `Observation ${index} about the invoice pipeline and its billing cadence.`,
      ).join('\n'),
    ]) {
      const input = { activeObservations, sources };
      expect(renderCandidateProjection(projectCandidateEntries(input))).toBe(projectCandidateContext(input));
    }
  });
});
