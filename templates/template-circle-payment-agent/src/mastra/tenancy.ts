import { mkdirSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

import type { RequestContext } from '@mastra/core/request-context';

/** Where a caller's identity is read from. Our own proxy sends exactly this. */
const IDENTITY_KEY = 'user-id';

/**
 * The directory every caller's home is created beneath.
 *
 * Deliberately a constant and not a setting. Isolation is the only mode this
 * agent has, because the alternative — one home directory, one `~/.circle-cli`,
 * one logged-in session — means whoever reaches the URL spends whoever funded
 * it. A switch for that is a switch for handing a stranger your wallet, and
 * the local case is not worth it: what it buys is skipping a login you do once
 * per username, and what it costs is a footgun that fires silently.
 *
 * Under the real home so tenant homes survive a restart, which is what keeps
 * that login a one-time cost rather than a per-boot ritual.
 */
function resolveRoot(): string {
  const preferred = join(homedir(), '.circle-agent', 'tenants');

  try {
    mkdirSync(preferred, { recursive: true });
    return preferred;
  } catch {
    // A container running as a UID with no passwd entry gets a `homedir()` it
    // cannot write to, and an unwritable root fails every request rather than
    // one. /tmp always works; the cost is that a restart empties it and every
    // tenant logs into Circle again.
    const fallback = join(tmpdir(), 'circle-agent-tenants');
    mkdirSync(fallback, { recursive: true });
    return fallback;
  }
}

// Resolved once, at startup: a root that cannot be created is worth finding out
// about before the first request rather than during it.
const TENANT_ROOT = resolveRoot();

/**
 * Thrown when a request arrives without an identity to attribute it to.
 *
 * There is no shared home to fall back to, which is the point — falling back is
 * how every caller ends up on one wallet. A caller with no `user-id` is a
 * misconfigured front end, and failing is the only answer that does not quietly
 * put someone else's money within reach.
 */
export class MissingIdentityError extends Error {
  constructor() {
    super(
      `No \`${IDENTITY_KEY}\` in requestContext. Every request must name the caller it belongs to; ` +
        'there is no shared workspace to fall back to.',
    );
    this.name = 'MissingIdentityError';
  }
}

/**
 * A directory name that cannot escape the root it is joined to.
 *
 * The identity arrives in a request body, so `../../root` is a thing a caller
 * can send. Anything outside a conservative alphabet is replaced rather than
 * rejected, and the result is length-capped so a long id cannot push the path
 * past the filesystem's limit.
 */
function safeSegment(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 64);
}

/**
 * The home directory for this request, created if it does not exist yet.
 *
 * Identical locally and deployed: the caller names itself, and that name is the
 * only thing that decides which files, which CLI config and which wallet the
 * shell can see.
 */
export function tenantHome(requestContext?: RequestContext): string {
  const id = requestContext?.get(IDENTITY_KEY);

  return tenantHomeFor(typeof id === 'string' ? id : undefined);
}

/**
 * The same directory, for a caller named outright rather than through a
 * `RequestContext`.
 *
 * The control-plane routes are the reason this exists: they are plain HTTP
 * handlers rather than agent runs, so the identity arrives in a JSON body and
 * there is no `RequestContext` to read it from. Routing both through one
 * function is what keeps a route and an agent run agreeing about which
 * directory a caller owns — two spellings of that answer would mean the wallet
 * a route logs in is not the wallet the agent then spends from.
 */
export function tenantHomeFor(id?: string): string {
  const segment = typeof id === 'string' ? safeSegment(id) : '';

  if (!segment) throw new MissingIdentityError();

  const home = join(TENANT_ROOT, segment);
  // Every sandbox command assumes its working directory exists; the first
  // request from a new caller is the one that would otherwise fail.
  mkdirSync(home, { recursive: true });

  return home;
}
