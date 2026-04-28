import { HTTPException } from '../http-exception';

const AVATAR_MAX_BYTES = 512 * 1024; // 512 KB

/**
 * Validates `metadata.avatarUrl` if present.
 * Ensures it's a well-formed data URL and the decoded payload is ≤ 512 KB.
 * No-ops when metadata is absent or doesn't contain avatarUrl.
 */
export function validateMetadataAvatarUrl(metadata: Record<string, unknown> | undefined): void {
  if (!metadata || !('avatarUrl' in metadata) || metadata.avatarUrl === null || metadata.avatarUrl === undefined)
    return;
  if (typeof metadata.avatarUrl !== 'string') {
    throw new HTTPException(400, { message: 'metadata.avatarUrl must be a string' });
  }

  const dataUrl = metadata.avatarUrl;
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new HTTPException(400, {
      message: 'metadata.avatarUrl must be a valid data URL (data:<mime>;base64,<data>)',
    });
  }

  let byteLength: number;
  try {
    byteLength = Buffer.from(match[2]!, 'base64').byteLength;
  } catch {
    throw new HTTPException(400, { message: 'metadata.avatarUrl contains invalid base64' });
  }

  if (byteLength === 0) {
    throw new HTTPException(400, { message: 'metadata.avatarUrl is empty' });
  }

  if (byteLength > AVATAR_MAX_BYTES) {
    throw new HTTPException(413, {
      message: `metadata.avatarUrl exceeds ${AVATAR_MAX_BYTES}-byte limit (got ${byteLength})`,
    });
  }
}
