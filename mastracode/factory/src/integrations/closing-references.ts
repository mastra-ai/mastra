/**
 * Issues a pull or merge request description says it closes, in the order it names them.
 *
 * Only the keyword forms GitHub and GitLab themselves act on count: `Fixes #12`, or
 * `Fixes owner/repo#12` naming the same repository. GitLab also accepts `Implements`, and a
 * list after one keyword (`Closes #1, #2 and #3`). References to other repositories, links, and
 * anything inside code or HTML comments (where PR templates keep their examples) are ignored.
 * Reading the description keeps this deterministic for replays and the reconcile sweep, at the
 * cost of links set only in GitHub's sidebar, which never show up here.
 */
export function closingIssueNumbers(
  text: string | null | undefined,
  options: { provider: 'github' | 'gitlab'; repository: string },
): number[] {
  if (!text) return [];
  const prose = text
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/(`{3,}|~{3,})[\s\S]*?(?:\1|$)/g, ' ')
    .replace(/`[^`\n]*`/g, ' ');
  const keywords =
    options.provider === 'gitlab'
      ? 'close[sd]?|closing|fix(?:e[sd]|ing)?|resolve[sd]?|resolving|implement(?:s|ed|ing)?'
      : 'close[sd]?|fix(?:e[sd])?|resolve[sd]?';
  const target = '(?:[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)+)?#\\d+';
  const separator = options.provider === 'gitlab' ? '(?:\\s*,\\s*|\\s*,?\\s+and\\s+)' : '(?!)';
  const reference = new RegExp(
    `(?<![\\w/#])(?:${keywords}):?\\s+(${target}(?:${separator}${target})*)(?![\\w/])`,
    'gi',
  );
  const repository = options.repository.toLowerCase();
  const numbers: number[] = [];
  for (const match of prose.matchAll(reference)) {
    for (const [, path, value] of match[1]!.matchAll(/([A-Za-z0-9_./-]*)#(\d+)/g)) {
      if (path && path.toLowerCase() !== repository) continue;
      const issueNumber = Number(value);
      if (Number.isSafeInteger(issueNumber) && issueNumber > 0 && !numbers.includes(issueNumber)) {
        numbers.push(issueNumber);
      }
    }
  }
  return numbers;
}
