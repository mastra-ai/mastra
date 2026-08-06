// A2A_PROTOCOL_VERSION ("1.0") and A2A_VERSION_HEADER ("A2A-Version") are on the
// SDK root, but A2A_LEGACY_PROTOCOL_VERSION ("0.3") is only exported from the
// v0.3 compat subpath — re-exported by @mastra/core/a2a as `a2aV03Compat`.
import { A2A_VERSION_HEADER, A2A_PROTOCOL_VERSION } from '@a2a-js/sdk';
import { MastraA2AError, a2aV03Compat } from '@mastra/core/a2a';

const A2A_LEGACY_PROTOCOL_VERSION = a2aV03Compat.A2A_LEGACY_PROTOCOL_VERSION;

/**
 * Wire versions of the A2A protocol that this server can speak. Values match
 * the `Major.Minor` form transmitted in the `A2A-Version` header.
 */
export type A2AProtocolVersion = typeof A2A_PROTOCOL_VERSION | '0.3';

/** The version served/assumed when a client does not send an `A2A-Version` header. */
export const DEFAULT_PROTOCOL_VERSION: A2AProtocolVersion = A2A_PROTOCOL_VERSION;

/** All protocol versions this server supports, newest first. */
export const SUPPORTED_PROTOCOL_VERSIONS: readonly A2AProtocolVersion[] = [
  A2A_PROTOCOL_VERSION,
  A2A_LEGACY_PROTOCOL_VERSION,
];

/** Re-export the header name so handlers/tests reference a single source of truth. */
export { A2A_VERSION_HEADER, A2A_PROTOCOL_VERSION, A2A_LEGACY_PROTOCOL_VERSION };

function normalizeHeaderValue(raw: string | null | undefined): string | undefined {
  if (raw == null) return undefined;
  const trimmed = raw.trim();
  return trimmed === '' ? undefined : trimmed;
}

/**
 * Reads a header value case-insensitively from either a Headers instance or a
 * plain record. A2A header names are matched case-insensitively per HTTP.
 */
function readHeader(
  headers: Headers | Record<string, string | string[] | undefined>,
  name: string,
): string | undefined {
  if (typeof (headers as Headers).get === 'function') {
    return normalizeHeaderValue((headers as Headers).get(name));
  }

  const record = headers as Record<string, string | string[] | undefined>;
  const lower = name.toLowerCase();
  for (const key of Object.keys(record)) {
    if (key.toLowerCase() === lower) {
      const value = record[key];
      return normalizeHeaderValue(Array.isArray(value) ? value[0] : value);
    }
  }
  return undefined;
}

/**
 * Resolves the A2A protocol version for an incoming request from its
 * `A2A-Version` header. Absent header defaults to {@link DEFAULT_PROTOCOL_VERSION}.
 * An unrecognized version throws {@link MastraA2AError.versionNotSupported}.
 *
 * Only the `Major.Minor` prefix is considered (e.g. `"1.0.3"` resolves to `"1.0"`),
 * so patch-level suffixes from peers are tolerated.
 */
export function resolveProtocolVersion(
  headers: Headers | Record<string, string | string[] | undefined>,
): A2AProtocolVersion {
  const raw = readHeader(headers, A2A_VERSION_HEADER);
  if (raw === undefined) {
    return DEFAULT_PROTOCOL_VERSION;
  }

  const majorMinor = raw.split('.').slice(0, 2).join('.');
  const match = SUPPORTED_PROTOCOL_VERSIONS.find(v => v === majorMinor);
  if (!match) {
    throw MastraA2AError.versionNotSupported(raw);
  }
  return match;
}

/** True when the negotiated version is the legacy v0.3 wire protocol. */
export function isLegacyVersion(version: A2AProtocolVersion): boolean {
  return version === A2A_LEGACY_PROTOCOL_VERSION;
}
