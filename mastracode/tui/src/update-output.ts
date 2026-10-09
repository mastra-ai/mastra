import type { UpdateOutcome } from '@mastra/code-sdk/utils/update-check';

/** Colors for update output. The shell command uses terminal colors; the TUI uses its theme. */
export interface UpdateStyle {
  accent(text: string): string;
  muted(text: string): string;
  error(text: string): string;
  warning(text: string): string;
  bold(text: string): string;
}

/** `Mastra Code  v1.0.0`, or `Mastra Code  v1.0.0 → v1.1.0` when a newer version is involved. */
export function formatUpdateHeader(style: UpdateStyle, currentVersion: string, latestVersion?: string): string {
  const versions = latestVersion
    ? `${style.muted(`v${currentVersion} →`)} ${style.accent(style.bold(`v${latestVersion}`))}`
    : style.muted(`v${currentVersion}`);
  return `${style.bold('Mastra Code')}  ${versions}`;
}

export function formatUpToDate(style: UpdateStyle): string {
  return `${style.accent('✓')} Up to date`;
}

export function formatRegistryError(style: UpdateStyle): string {
  return `${style.error('✗')} Couldn't reach the npm registry. Check your connection and try again.`;
}

export function formatInstallingLabel(style: UpdateStyle, update: { via: string; command: string }): string {
  return `Installing with ${update.via}  ${style.muted(update.command)}`;
}

/**
 * Lines describing an update outcome. `updated` gets a single ✓ line; a
 * failed or unchanged update gets a status line, muted details, and the
 * command to run instead.
 */
export function formatUpdateOutcome(
  style: UpdateStyle,
  outcome: UpdateOutcome,
  latestVersion: string,
  { restartHint = false }: { restartHint?: boolean } = {},
): string[] {
  const detail = (text: string) => `  ${style.muted(text)}`;

  if (outcome.status === 'updated') {
    const hint = restartHint ? `. Run ${style.accent('mastracode')} to start the new version.` : '';
    return [`${style.accent('✓')} Updated with ${outcome.via}${hint}`];
  }

  if (outcome.status === 'failed') {
    const lines = [`${style.error('✗')} Update failed`];
    for (const line of outcome.details?.split('\n') ?? []) lines.push(detail(line));
    if (outcome.command) lines.push('', `Run it yourself:  ${style.accent(outcome.command)}`);
    return lines;
  }

  if (outcome.managedBy) {
    return [
      `${style.warning('!')} Installed with ${outcome.managedBy}, so update it there:`,
      '',
      `  ${style.accent(outcome.command)}`,
    ];
  }

  const lines = [`${style.warning('!')} This Mastra Code wasn't updated`];
  if (outcome.ranWith && outcome.runningVersion) {
    lines.push(
      detail(
        `${outcome.ranWith} installed v${latestVersion}, but the copy you're running is still v${outcome.runningVersion}`,
      ),
    );
    if (outcome.installDir) lines.push(detail(`at ${outcome.installDir}`));
  } else if (outcome.installDir) {
    lines.push(detail(`It was installed by another tool, at ${outcome.installDir}`));
  }
  lines.push('', `Update it with the tool that installed it, or run:  ${style.accent(outcome.command)}`);
  return lines;
}
