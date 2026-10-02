/** Two tool observers read the same `gh pr create`, so the reading lives here rather than once per observer. */

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
