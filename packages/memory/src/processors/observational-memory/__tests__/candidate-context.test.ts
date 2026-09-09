import { describe, expect, it } from 'vitest';

import { CANDIDATE_CONTEXT_MAX_CHARACTERS, projectCandidateContext } from '../subconscious/candidate-context';

const source = (id: string, text: string) => ({ type: 'record' as const, id, text });

describe('candidate context projection', () => {
  it('reports, per candidate, the accumulated observations that reference it', () => {
    const activeObservations = [
      'Jamie switched the invoice pipeline to quarterly billing.',
      'The kitchen renovation is blocked on the countertop supplier.',
      'Tyler prefers reviews posted before standup.',
    ].join('\n');

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
      activeObservations: 'The kitchen renovation is blocked on the countertop supplier.',
      sources: [source('k-invoice', 'invoice pipeline billing cadence')],
    });

    expect(result).toContain('k-invoice');
    expect(result).toMatch(/no accumulated observation references/i);
    // must never assert the parent forgot it — absence of a lexical match is not absence of knowledge
    expect(result).not.toMatch(/forgot|no longer knows|not in context/i);
  });

  it('attributes each excerpt to the candidate it matched rather than merging them', () => {
    const activeObservations = [
      'Jamie switched the invoice pipeline to quarterly billing.',
      'The kitchen renovation is blocked on the countertop supplier.',
    ].join('\n');

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
    const activeObservations = 'Jamie switched the invoice pipeline to quarterly billing.';

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
});
