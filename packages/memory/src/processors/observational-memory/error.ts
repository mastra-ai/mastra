function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Keep provider diagnostics in streamed/persisted markers, not whole API request/response objects. */
export function formatOmError(error: unknown): string {
  const details = new Set<string>();
  const visited = new Set<object>();
  const add = (value: unknown) => {
    if (typeof value === 'string' && value.trim()) details.add(value.trim().slice(0, 2000));
  };

  function collectErrorDetails(value: unknown, depth: number) {
    if (depth > 5) return;
    if (!isRecord(value)) {
      if (value !== undefined) add(String(value));
      return;
    }
    if (visited.has(value)) return;
    visited.add(value);
    add(value.message);
    if (typeof value.statusCode === 'number') add(`HTTP ${value.statusCode}`);

    // Only extract the provider's diagnostic message. Bodies may also contain
    // echoed prompts, credentials, headers, or HTML from an upstream proxy.
    if (typeof value.responseBody === 'string') {
      try {
        const body: unknown = JSON.parse(value.responseBody);
        if (isRecord(body)) {
          add(body.message);
          if (isRecord(body.error)) add(body.error.message);
          else add(body.error);
        }
      } catch {
        // A non-JSON body is not safe to include in a persisted marker.
      }
    }
    if (value.cause !== undefined) collectErrorDetails(value.cause, depth + 1);
    if (value.error !== undefined) collectErrorDetails(value.error, depth + 1);
  }

  try {
    collectErrorDetails(error, 0);
  } catch {
    // Stop on malformed thrown values, but preserve diagnostics already collected.
  }
  const message = [...details].join(': ') || 'Unknown error';
  return message.length > 2000 ? `${message.slice(0, 1997)}...` : message;
}
