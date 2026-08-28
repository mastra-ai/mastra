export function isReconnectableMCPError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const errorMessage = error.message.toLowerCase();

  return (
    errorMessage.includes('no valid session') ||
    errorMessage.includes('session') ||
    errorMessage.includes('server not initialized') ||
    errorMessage.includes('not connected') ||
    errorMessage.includes('http 400') ||
    errorMessage.includes('http 401') ||
    errorMessage.includes('http 403') ||
    errorMessage.includes('http 404') ||
    errorMessage.includes('econnrefused') ||
    errorMessage.includes('fetch failed') ||
    errorMessage.includes('connection refused') ||
    errorMessage.includes('connection closed') ||
    errorMessage.includes('sse stream disconnected') ||
    errorMessage.includes('typeerror: terminated')
  );
}

/** Structured transport metadata for a failed aggregate MCP discovery. */
export interface MCPDiscoveryErrorDetails {
  /** Human-readable failure message. Includes `(HTTP nnn)` when an HTTP status is available. */
  message: string;
  /** HTTP response status reported by the MCP transport. */
  httpStatus?: number;
  /** Deepest error code in the cause chain, such as an MCP SDK, network, or application error code. */
  code?: string | number;
}

const MAX_DISCOVERY_ERROR_CAUSE_DEPTH = 8;

function isHttpStatus(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 100 && value <= 599;
}

function asErrorRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined;
}

function getErrorProperty(record: Record<string, unknown> | undefined, property: string): unknown {
  if (!record) return undefined;

  try {
    return record[property];
  } catch {
    // Third-party errors can expose values through getters or Proxy traps.
    // Discovery error reporting must never turn one server failure into an
    // aggregate rejection merely because inspecting that failure throws.
    return undefined;
  }
}

function getErrorMessage(error: unknown): string {
  const message = getErrorProperty(asErrorRecord(error), 'message');
  if (typeof message === 'string') return message;

  try {
    return String(error);
  } catch {
    return 'Unknown error';
  }
}

/**
 * Preserve machine-readable transport metadata before aggregate discovery turns
 * a thrown error into its legacy per-server string.
 *
 * MCP SDK 2 keeps an HTTP response status on `SdkHttpError.status` while
 * `code` is a string SDK code. Older transports and wrappers have also used
 * `statusCode`; only explicit status fields are treated as HTTP metadata so a
 * numeric SDK or application `code` is not mislabeled. The walk is bounded and
 * cycle-safe because application errors may wrap arbitrary third-party causes.
 */
export function getMCPDiscoveryErrorDetails(error: unknown): MCPDiscoveryErrorDetails {
  let message = getErrorMessage(error);
  let httpStatus: number | undefined;
  let code: string | number | undefined;
  let current: unknown = error;
  const seen = new Set<unknown>();

  for (
    let depth = 0;
    depth < MAX_DISCOVERY_ERROR_CAUSE_DEPTH && current !== undefined && current !== null && !seen.has(current);
    depth++
  ) {
    seen.add(current);
    const record = asErrorRecord(current);
    if (!record) break;

    const data = asErrorRecord(getErrorProperty(record, 'data'));
    if (httpStatus === undefined) {
      for (const candidate of [
        getErrorProperty(record, 'status'),
        getErrorProperty(record, 'statusCode'),
        getErrorProperty(data, 'status'),
        getErrorProperty(data, 'statusCode'),
      ]) {
        if (isHttpStatus(candidate)) {
          httpStatus = candidate;
          break;
        }
      }
    }

    for (const candidate of [getErrorProperty(record, 'code'), getErrorProperty(data, 'code')]) {
      if (typeof candidate === 'string' || typeof candidate === 'number') {
        // Prefer the deepest code: outer Mastra errors describe the aggregate
        // operation, while the innermost SDK/network code classifies the cause.
        code = candidate;
      }
    }

    current = getErrorProperty(record, 'cause');
  }

  if (httpStatus !== undefined && !message.includes(`(HTTP ${httpStatus})`)) {
    message += ` (HTTP ${httpStatus})`;
  }

  return {
    message,
    ...(httpStatus !== undefined ? { httpStatus } : {}),
    ...(code !== undefined ? { code } : {}),
  };
}
