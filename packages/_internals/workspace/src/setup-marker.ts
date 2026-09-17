import { createHash } from 'node:crypto';

/**
 * Setup completion marker shared by repo templates and their consumers.
 *
 * A repo template writes this file beside the checkout as its last build
 * step, so it exists only in images where every setup command succeeded. Its
 * content is a digest of the setup commands the image ran, letting a sandbox
 * booted from the image tell whether the setup it is about to run already
 * happened. Relative to the template's build cwd, which is also the runtime
 * working directory the repo was cloned into.
 */
export const SETUP_MARKER_PATH = '.mastra-sandbox/setup';

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
export function setupMarkerCommand(content: string): string {
  return `mkdir -p "$(dirname "${SETUP_MARKER_PATH}")" && printf '%s' '${content}' > "${SETUP_MARKER_PATH}"`;
}
