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

export function projectCandidateContext({
  activeObservations,
  sources,
}: {
  activeObservations: string;
  sources: CandidateContextSource[];
}): string {
  const observations = activeObservations
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  if (observations.length === 0) {
    return 'No accumulated observations were available for this check.';
  }

  const indexed = observations.map(line => ({ line, terms: extractDistinctiveTerms(line) }));
  const sections: string[] = [];

  for (const source of sources) {
    const candidateTerms = extractDistinctiveTerms([source.text, source.title].filter(Boolean).join(' '));
    const matches = candidateTerms.size
      ? indexed.filter(entry => sharedTermCount(entry.terms, candidateTerms) >= MIN_SHARED_TERMS)
      : [];

    if (matches.length === 0) {
      sections.push(
        `Candidate ${source.id}: no accumulated observation references it by wording. This reports a missing wording overlap only, and is not evidence about what the parent still holds.`,
      );
      continue;
    }

    const shown = matches.slice(0, MAX_EXCERPTS_PER_CANDIDATE);
    const lines = shown.map(entry => `- ${entry.line}`);
    if (matches.length > shown.length) {
      lines.push(`[omitted ${matches.length - shown.length} further matching observations]`);
    }
    sections.push(`Candidate ${source.id}: accumulated observations that mention it:\n${lines.join('\n')}`);
  }

  const projected = sections.join('\n\n');
  if (projected.length <= CANDIDATE_CONTEXT_MAX_CHARACTERS) return projected;

  const marker = '\n[omitted to fit the candidate context budget]';
  return projected.slice(0, CANDIDATE_CONTEXT_MAX_CHARACTERS - marker.length) + marker;
}
