/**
 * Normalizes the first non-empty line of a review body so its `Verdict:` line can be read
 * regardless of the markdown it is wrapped in (`**Verdict:** request changes`, `# Verdict: ...`).
 */
export function normalizedVerdictLine(body: string | undefined): string | undefined {
  const firstLine = body
    ?.split('\n')
    .map(line => line.trim())
    .find(line => line.length > 0);
  if (!firstLine) return undefined;
  return firstLine
    .replaceAll(/[*_`#>\s]+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Detects the `factory-review` handoff verdict in a comment body.
 *
 * GitHub forbids an app from reviewing a pull request it authored, so on
 * Factory-authored PRs the review skill falls back to posting its verdict as a
 * plain comment. That comment is the only signal the authoring agent gets, so
 * it has to be readable back out. The skill's handoff contract puts the verdict
 * on the first line (`Verdict: request changes`), so only that line is
 * inspected — a verdict quoted later in the findings must not count.
 */
export function requestsChangesVerdict(body: string | undefined): boolean {
  // Tolerate the markdown the skill wraps the line in (`**Verdict: ...**`).
  const normalized = normalizedVerdictLine(body);
  if (!normalized) return false;
  // Match the verdict exactly so negated phrasings ("Verdict: do not request
  // changes") cannot wake the author.
  return /^verdict: ?(request changes|changes requested)$/.test(normalized);
}
