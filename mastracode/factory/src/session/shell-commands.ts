/** Tool observers read the same shell commands, so the reading lives here rather than once per observer. */

const GH_PR_CREATE_RE = /(?:^|\n|;|&&|\|\|)\s*gh\s+pr\s+create(?:\s|$)/;

/** Heredoc bodies dropped, so prose inside a document never reads as a command. */
export function executableCommand(command: string): string {
  const lines = command.split('\n');
  const executableLines: string[] = [];
  let delimiter: string | undefined;

  for (const line of lines) {
    if (delimiter) {
      if (line.trim() === delimiter) delimiter = undefined;
      continue;
    }
    executableLines.push(line);
    const heredoc = line.match(/<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/);
    delimiter = heredoc?.[2];
  }

  return executableLines.join('\n');
}

export function runsPullRequestCreate(command: string): boolean {
  return GH_PR_CREATE_RE.test(executableCommand(command));
}

const GIT_PUSH_RE = /(?:^|\n|;|&&|\|\|)\s*git\s+(?:-C\s+\S+\s+)?push(?:\s[^\n;&|]*)?(?=$|\n|;|&&|\|\|)/g;
const DRY_RUN_FLAG_RE = /\s(?:--dry-run|-[a-zA-Z]*n[a-zA-Z]*)(?=\s|$)/;

/** A `git push` that sends updates; `--dry-run`/`-n` report updates without making them. */
export function runsGitPush(command: string): boolean {
  return [...executableCommand(command).matchAll(GIT_PUSH_RE)].some(match => !DRY_RUN_FLAG_RE.test(match[0]));
}
