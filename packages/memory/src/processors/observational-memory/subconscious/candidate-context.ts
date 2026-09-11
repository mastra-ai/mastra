/**
 * Projects the parent's accumulated active observations down to the parts that actually mention
 * the current check's candidates.
 *
 * The passive-check prompt already carries the parent's whole accumulated observation memory. That
 * answers "what does the parent know" but not "what does the parent know *about this candidate*",
 * and it grows without regard to how much of it is relevant. This projection answers the narrower
 * question with a bounded, per-candidate excerpt.
 *
 * The join is lexical, using the same distinctive-term extraction that selects reminder candidates
 * in the first place. It is deliberately not semantic: an excerpt is evidence the reminder agent
 * can read, never a verdict about whether the parent still holds a fact. Absence of a lexical match
 * is reported as absence of a match, nothing stronger.
 */

/** Hard ceiling for the whole projected block, independent of how large active observations grow. */
export const CANDIDATE_CONTEXT_MAX_CHARACTERS = 4 * 1024;
/** A candidate must share at least this many distinctive terms with an observation to be a match. */
const MIN_SHARED_TERMS = 2;
const MAX_EXCERPTS_PER_CANDIDATE = 5;

const STOP_WORDS = new Set([
  'about',
  'after',
  'before',
  'current',
  'from',
  'have',
  'observations',
  'that',
  'their',
  'there',
  'they',
  'this',
  'user',
  'what',
  'when',
  'where',
  'which',
  'with',
]);

/** Distinctive lowercase terms of a text, matching the candidate-search term rules. */
export function extractDistinctiveTerms(text: string): Set<string> {
  return new Set(
    text
      .match(/[A-Za-z0-9][A-Za-z0-9_-]{3,}/g)
      ?.map(term => term.toLowerCase())
      .filter(term => !STOP_WORDS.has(term)) ?? [],
  );
}

function sharedTermCount(observationTerms: Set<string>, candidateTerms: Set<string>): number {
  let shared = 0;
  for (const term of candidateTerms) if (observationTerms.has(term)) shared += 1;
  return shared;
}

export type CandidateContextSource = { id: string; text?: string; title?: string; recordId?: string };

/**
 * One candidate's slice of the projection. The excerpt is the candidate's rendered section verbatim.
 *
 * `match` is first class rather than something a reader infers from the excerpt's wording: the
 * no-match copy is prose meant for a model, and deriving state by string-matching it would make that
 * prose load-bearing in two places at once. `no-match` means no lexical overlap was found under the
 * current matching rule — never that the parent stopped holding the fact.
 */
export type CandidateContextEntry = { id: string; match: 'matched' | 'no-match'; excerpt: string };

/**
 * Two regimes, kept explicit so callers can tell them apart.
 *
 * `passthrough` has no per-candidate identity at all — the whole accumulated memory is forwarded as
 * one block — so anything keyed by candidate (deltas, per-candidate markers) has nothing to key on.
 * `filtered` gives every candidate exactly one entry, including candidates nothing matched.
 */
export type CandidateContextProjection =
  | { regime: 'passthrough'; text: string }
  | { regime: 'filtered'; entries: CandidateContextEntry[] };

export function projectCandidateEntries({
  activeObservations,
  sources,
}: {
  activeObservations: string;
  sources: CandidateContextSource[];
}): CandidateContextProjection {
  const observations = activeObservations
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  if (observations.length === 0) {
    return { regime: 'passthrough', text: 'No accumulated observations were available for this check.' };
  }

  // Below the budget the projection buys nothing: forwarding everything costs no more than the
  // ceiling we already accept, and it lets the reminder agent notice redundancy the lexical join
  // cannot see, such as the same fact in entirely different words. Only pay the recall cost of
  // filtering once the accumulated memory is the size problem the filtering exists to solve.
  const whole = observations.join('\n');
  if (whole.length <= CANDIDATE_CONTEXT_MAX_CHARACTERS) {
    return {
      regime: 'passthrough',
      text: `All accumulated observations already visible to the parent agent:\n${whole}`,
    };
  }

  const indexed = observations.map(line => ({ line, terms: extractDistinctiveTerms(line) }));
  const entries: CandidateContextEntry[] = [];

  for (const source of sources) {
    const candidateTerms = extractDistinctiveTerms([source.text, source.title].filter(Boolean).join(' '));
    const matches = candidateTerms.size
      ? indexed.filter(entry => sharedTermCount(entry.terms, candidateTerms) >= MIN_SHARED_TERMS)
      : [];

    if (matches.length === 0) {
      entries.push({
        id: source.id,
        match: 'no-match',
        excerpt: `Candidate ${source.id}: no accumulated observation references it by wording. This reports a missing wording overlap only, and is not evidence about what the parent still holds.`,
      });
      continue;
    }

    const shown = matches.slice(0, MAX_EXCERPTS_PER_CANDIDATE);
    const lines = shown.map(entry => `- ${entry.line}`);
    if (matches.length > shown.length) {
      lines.push(`[omitted ${matches.length - shown.length} further matching observations]`);
    }
    entries.push({
      id: source.id,
      match: 'matched',
      excerpt: `Candidate ${source.id}: accumulated observations that mention it:\n${lines.join('\n')}`,
    });
  }

  return { regime: 'filtered', entries };
}

/** Renders a projection back to the block the passive-check prompt and the state lane both carry. */
export function renderCandidateProjection(projection: CandidateContextProjection): string {
  if (projection.regime === 'passthrough') return projection.text;

  const projected = projection.entries.map(entry => entry.excerpt).join('\n\n');
  if (projected.length <= CANDIDATE_CONTEXT_MAX_CHARACTERS) return projected;

  const marker = '\n[omitted to fit the candidate context budget]';
  return projected.slice(0, CANDIDATE_CONTEXT_MAX_CHARACTERS - marker.length) + marker;
}
