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
