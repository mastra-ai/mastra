import { HTTPException } from '../http-exception';

const AVATAR_MAX_BYTES = 512 * 1024; // 512 KB — applies to inlined data: URLs only

/** Recognised `mastra-avatar:<agentId>` scheme prefix. */
export const MASTRA_AVATAR_SCHEME = 'mastra-avatar:';

/**
 * Structural check for a `mastra-avatar:<agentId>` URL. The agent ID segment
 * must be a safe filename fragment (no `/`, no `..`, no whitespace) so it
 * cannot escape the avatar store's namespace or be confused with a path.
 */
function isValidMastraAvatarUrl(value: string): boolean {
  if (!value.startsWith(MASTRA_AVATAR_SCHEME)) return false;
  const id = value.slice(MASTRA_AVATAR_SCHEME.length);
  if (!id) return false;
  if (id.includes('/') || id.includes('\\') || id.includes('..')) return false;
  if (/\s/.test(id)) return false;
  return true;
}

/**
 * Validates `metadata.avatarUrl` if present. Accepts:
 *   - `data:<mime>;base64,<data>` URLs, capped at 512 KB decoded
 *   - `mastra-avatar:<agentId>` references resolved by the server's avatar route
 *   - Absolute `http://` / `https://` URLs (custom AvatarStore return values)
 * No-ops when metadata is absent or doesn't contain `avatarUrl`.
 *
 * When `expectedAgentId` is provided, `mastra-avatar:<agentId>` URLs must match
 * the record being written — otherwise a caller could point one agent's avatar
 * at another agent's stored bytes.
 */
export function validateMetadataAvatarUrl(
  metadata: Record<string, unknown> | undefined,
  expectedAgentId?: string,
): void {
  if (!metadata || !('avatarUrl' in metadata) || metadata.avatarUrl === null || metadata.avatarUrl === undefined)
    return;
  if (typeof metadata.avatarUrl !== 'string') {
    throw new HTTPException(400, { message: 'metadata.avatarUrl must be a string' });
  }

  const value = metadata.avatarUrl;

  // mastra-avatar:<agentId> — resolved via GET /agents/:agentId/avatar.
  if (value.startsWith(MASTRA_AVATAR_SCHEME)) {
    if (!isValidMastraAvatarUrl(value)) {
      throw new HTTPException(400, {
        message: 'metadata.avatarUrl must be a valid mastra-avatar:<agentId> reference',
      });
    }
    if (expectedAgentId) {
      const id = value.slice(MASTRA_AVATAR_SCHEME.length);
      if (id !== expectedAgentId) {
        throw new HTTPException(400, {
          message: `metadata.avatarUrl mastra-avatar id (${id}) must match agent id (${expectedAgentId})`,
        });
      }
    }
    return;
  }

  // Absolute http(s) URL — custom AvatarStore return values (e.g. S3, CDN).
  if (value.startsWith('http://') || value.startsWith('https://')) {
    try {
      // Throws on malformed URL.
      new URL(value);
    } catch {
      throw new HTTPException(400, { message: 'metadata.avatarUrl is not a valid URL' });
    }
    return;
  }

  const match = value.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new HTTPException(400, {
      message: 'metadata.avatarUrl must be a data: URL, mastra-avatar:<agentId> reference, or absolute http(s) URL',
    });
  }

  // `Buffer.from(..., 'base64')` decodes leniently — it silently ignores
  // invalid characters and never throws. Validate the payload format strictly
  // before measuring its byte length so malformed input is rejected.
  const base64Payload = match[2]!;
  const isStrictBase64 =
    base64Payload.length > 0 &&
    base64Payload.length % 4 === 0 &&
    /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64Payload);
  if (!isStrictBase64) {
    throw new HTTPException(400, { message: 'metadata.avatarUrl contains invalid base64' });
  }
  const byteLength = Buffer.from(base64Payload, 'base64').byteLength;

  if (byteLength === 0) {
    throw new HTTPException(400, { message: 'metadata.avatarUrl is empty' });
  }

  if (byteLength > AVATAR_MAX_BYTES) {
    throw new HTTPException(413, {
      message: `metadata.avatarUrl exceeds ${AVATAR_MAX_BYTES}-byte limit (got ${byteLength})`,
    });
  }
}
