import { createHash } from 'node:crypto';

/** Directory, relative to the template's build cwd, that holds every marker below. */
export const SETUP_MARKER_DIR = '.mastra-sandbox';

/**
 * Setup completion marker shared by repo templates and their consumers.
 *
 * A repo template writes this file beside the checkout as its last build
 * step, so it exists only in images where every setup command succeeded. Its
 * content is a digest of the setup commands the image ran, letting a sandbox
 * booted from the image tell whether the setup it is about to run already
 * happened. Relative to the template's build cwd, which is also the runtime
 * working directory the repo was cloned into.
 *
 * This is the single-repository marker. Templates built from a repository
 * list write one marker per repository instead ({@link repoSetupMarkerPath}).
 */
export const SETUP_MARKER_PATH = '.mastra-sandbox/setup';

/**
 * Marker for the workspace-level setup of a multi-repository template: the
 * commands that ran at the working directory after every repository was set
 * up. Written even when there were no such commands, so a consumer can tell
 * "ran nothing" from "never built".
 */
export const WORKSPACE_SETUP_MARKER_PATH = '.mastra-sandbox/workspace-setup';

/**
 * One line per repository directory whose setup failed while the build was
 * told to continue. Absent when nothing failed. Consumers check this before
 * trusting a per-repository marker: that marker means every step ran, not
 * that every step succeeded.
 */
export const SETUP_FAILED_MARKER_PATH = '.mastra-sandbox/setup-failed';

/** Per-repository marker of a multi-repository template, keyed by the clone directory name. */
export function repoSetupMarkerPath(repoDir: string): string {
  return `${SETUP_MARKER_DIR}/repos/${repoDir}`;
}

/** Blank entries never become build steps, so they never count toward the digest either. */
export function normalizeSetupCommands(setupCommand: string | readonly string[] | undefined): string[] {
  const list = setupCommand === undefined ? [] : Array.isArray(setupCommand) ? setupCommand : [setupCommand];
  return (list as string[]).filter(command => command.trim() !== '');
}

/** The marker content for a setup command list: `sha256:<hex>` over the commands joined by newlines. */
export function setupMarkerContent(setupCommand: string | readonly string[] | undefined): string {
  const digest = createHash('sha256').update(normalizeSetupCommands(setupCommand).join('\n')).digest('hex');
  return `sha256:${digest}`;
}

/** Shell step that writes the marker relative to the cwd. `content` is a digest, so it is shell-safe. */
export function setupMarkerCommand(content: string, markerPath: string = SETUP_MARKER_PATH): string {
  return `mkdir -p "$(dirname "${markerPath}")" && printf '%s' '${content}' > "${markerPath}"`;
}

export interface GuardedSetupCommandOptions {
  /** Clone directory the command runs in, relative to the build cwd. Shell-safe (`[\w.-]` only). */
  repoDir: string;
  /** The setup command, run verbatim inside `repoDir`. */
  command: string;
  /** When true a failure appends `repoDir` to {@link SETUP_FAILED_MARKER_PATH} instead of failing the step. */
  continueOnFailure: boolean;
}

/**
 * Shell step that runs one setup command inside a repository clone.
 *
 * Without the guard this is the plain `cd "<dir>" && <cmd>` step. With it,
 * the `cd` sits inside the parenthesized group so that the failure branch
 * runs back at the build cwd and the failure list lands at the workspace
 * level, never inside the repository. The newline before the inner group's
 * closing paren keeps a command that ends in a shell comment from swallowing it.
 */
export function guardedSetupCommand({ repoDir, command, continueOnFailure }: GuardedSetupCommandOptions): string {
  if (!continueOnFailure) return `cd "${repoDir}" && ${command}`;
  // The command runs through `sh -c` so a trailing comment, heredoc or stray
  // quote inside it cannot swallow the guard, and the whole step stays on one
  // line (a Dockerfile RUN cannot span lines). One line per repository: the
  // same guarded command runs before and after the pin.
  return (
    `( cd "${repoDir}" && sh -c ${shellQuote(command)} ) || ` +
    `{ mkdir -p "${SETUP_MARKER_DIR}" && grep -qxF -- '${repoDir}' "${SETUP_FAILED_MARKER_PATH}" 2>/dev/null || ` +
    `printf '%s\\n' '${repoDir}' >> "${SETUP_FAILED_MARKER_PATH}"; }`
  );
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
