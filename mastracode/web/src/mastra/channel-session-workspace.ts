/**
 * Per-session workspace isolation for controller channel sessions.
 *
 * An inbound Slack `@mention` starts an AgentController session. Without this,
 * every channel session falls through to the controller's default `projectPath`
 * (the web-server cwd), so a Slack-triggered agent would run `git`/edits inside
 * whatever directory the server happens to be in — and two different channel
 * threads would collide on the same workspace.
 *
 * This computes a fresh, empty scratch directory keyed by the channel
 * `resourceId`, under the same sandbox root the GitHub checkout flow uses. The
 * directory is created lazily on first use and reused on follow-up messages for
 * the same thread (the resolved path is stable per `resourceId`).
 *
 * v1 is an EMPTY scratch dir — no repo is cloned into it. The agent can
 * `git clone` itself if it needs a repo. Automatic worktrees are a later PR.
 */

import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { getLocalSandboxRoot } from '../web/github/local-sandbox.js';
import { getSandboxProvider } from '../web/github/sandbox.js';

/**
 * The base directory under which per-session scratch dirs are created. Mirrors
 * `computeSandboxWorkdir`'s provider-aware precedence: the local provider runs
 * on the host filesystem (where a cloud path like `/workspace` is not writable),
 * so it uses the local sandbox root; cloud providers use
 * `MASTRACODE_SANDBOX_WORKDIR` (default `/workspace`).
 */
function getSessionWorkspaceBase(): string {
  if (getSandboxProvider() === 'local') {
    return getLocalSandboxRoot().replace(/\/$/, '');
  }
  const base = process.env.MASTRACODE_SANDBOX_WORKDIR;
  if (base) return base.replace(/\/$/, '');
  return '/workspace';
}

/**
 * Compute (and lazily create) the isolated scratch directory for a controller
 * channel session. Keyed by the channel `resourceId` so follow-up messages on
 * the same thread reuse the same directory, and two distinct threads get two
 * distinct directories.
 *
 * The `.mc-sessions/` prefix leads with a dot so these never collide with GitHub
 * repo checkouts, which land at `<root>/<repoShortName>` (repo names cannot start
 * with a dot).
 */
export async function resolveChannelSessionProjectPath({ resourceId }: { resourceId: string }): Promise<string> {
  // 16 hex chars (64 bits) of sha256 — filesystem-safe, stable per resourceId,
  // collision between two live channel resourceIds is negligible.
  const hash = createHash('sha256').update(resourceId).digest('hex').slice(0, 16);
  const dir = `${getSessionWorkspaceBase()}/.mc-sessions/${hash}`;
  // Create eagerly so the directory exists before the sandbox binds
  // `workingDirectory` to it. `mkdir -p` is idempotent, so racing concurrent
  // first messages on the same thread is benign.
  await mkdir(dir, { recursive: true });
  return dir;
}
