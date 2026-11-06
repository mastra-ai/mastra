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
  const prose = withoutFences(text.replace(/<!--[\s\S]*?(?:-->|$)/g, ' ')).replace(/`[^`\n]*`/g, ' ');
  const keywords =
    options.provider === 'gitlab'
      ? 'close[sd]?|closing|fix(?:e[sd]|ing)?|resolve[sd]?|resolving|implement(?:s|ed|ing)?'
      : 'close[sd]?|fix(?:e[sd])?|resolve[sd]?';
  const target = '(?:[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)+)?#\\d+';
  const separator = options.provider === 'gitlab' ? '(?:\\s*,(?:\\s+and)?\\s*|\\s+and\\s+)' : '(?!)';
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

/** The end of the run of `char` starting at `start`. */
function runEnd(text: string, char: string, start: number): number {
  let end = start;
  while (text[end] === char) end++;
  return end;
}

/**
 * `text` with each code fence replaced by a space: a run of three or more backticks or tildes up
 * to the first run of the same character at least as long, or to the end. A scan rather than a
 * backreference regex, which compares the whole opening run at every position and so takes
 * quadratic time on long runs. Each character is read once.
 */
function withoutFences(text: string): string {
  let out = '';
  let from = 0;
  for (;;) {
    const backtick = text.indexOf('```', from);
    const tilde = text.indexOf('~~~', from);
    const start = backtick < 0 ? tilde : tilde < 0 ? backtick : Math.min(backtick, tilde);
    if (start < 0) return out + text.slice(from);
    out += `${text.slice(from, start)} `;
    const char = text[start]!;
    const openEnd = runEnd(text, char, start);
    const length = openEnd - start;
    let next = text.indexOf(char, openEnd);
    from = text.length;
    while (next >= 0) {
      const end = runEnd(text, char, next);
      if (end - next >= length) {
        // The closing run ends the fence after as many characters as opened it.
        from = next + length;
        break;
      }
      next = text.indexOf(char, end);
    }
  }
}
