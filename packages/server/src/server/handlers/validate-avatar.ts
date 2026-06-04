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
