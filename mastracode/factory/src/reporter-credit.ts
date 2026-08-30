// A GitHub login is alphanumeric with interior hyphens — no underscores, no
// spaces. Checking the grammar rejects the placeholder the issue poller stamps
// when the reporter's account is gone (`__unknown__`), which would otherwise
// become a trailer crediting an account that does not exist.
const GITHUB_LOGIN = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;

/**
 * The reporter earns a `Co-Authored-By` trailer on the work their report
 * caused, whether the run was dispatched by a rule or clicked from the board.
 * Only a GitHub login qualifies — Linear stamps a display name and a manual
 * card stamps nothing — and Factory's own bot reports are skipped. The trailer
 * needs the reporter's numeric id, which intake does not stamp, so the agent
 * resolves it from the same issue it is already reading.
 */
export function reporterCredit(author: unknown): string {
  if (typeof author !== 'string' || !author) return '';
  if (author.endsWith('[bot]') || !GITHUB_LOGIN.test(author)) return '';
  return (
    ` The work was reported by @${author}: credit them on every commit with a ` +
    `\`Co-Authored-By: ${author} <ID+${author}@users.noreply.github.com>\` trailer, ` +
    `resolving ID with \`gh api users/${author} --jq .id\`.`
  );
}
