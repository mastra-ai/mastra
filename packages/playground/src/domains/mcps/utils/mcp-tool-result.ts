function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The ui:// resource URI from a tool's `_meta`, supporting both the modern and the legacy flat key. */
export function getAppResourceUri(meta: unknown): string | undefined {
  if (!isRecord(meta)) return undefined;
  if (isRecord(meta.ui) && typeof meta.ui.resourceUri === 'string') return meta.ui.resourceUri;
  const legacy = meta['ui/resourceUri'];
  return typeof legacy === 'string' ? legacy : undefined;
}

/**
 * An MCP 2.x tool answers with `{ status: 'suspended' }` when it needs more input before it can finish.
 * Studio has no way to collect that input, so the response is explained rather than shown as the tool's output.
 */
export function isSuspendedResult(result: unknown): boolean {
  return isRecord(result) && result.status === 'suspended';
}
