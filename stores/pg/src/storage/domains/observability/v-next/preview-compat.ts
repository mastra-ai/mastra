import * as coreStorage from '@mastra/core/storage';

// Namespace access keeps adapters loadable with core versions predating previews.
const generator = coreStorage.buildStoredPreview as
  | ((preview: string | null | undefined, value: unknown, serialized?: string | null) => string)
  | undefined;
export const canGeneratePreviews = typeof generator === 'function';

/** SQL detection only; preview formatting stays in TypeScript. Empty strings are intentional. */
export function missingPreviewSql(column: string): string {
  return canGeneratePreviews ? `${column} IS NULL` : 'FALSE';
}

export function needsPreview(value: unknown): boolean {
  return canGeneratePreviews && value == null;
}

export function storedPreview(
  preview: string | null | undefined,
  value: unknown,
  serialized?: string | null,
): string | null {
  return canGeneratePreviews ? generator!(preview, value, serialized) : (preview ?? null);
}

export function readPreview(preview: unknown, payload?: unknown, jsonEncoded = false): string | null {
  const supplied = preview as string | null | undefined;
  if (!canGeneratePreviews) return supplied ?? null;
  // A stored empty string is the writer's explicit "nothing to preview" sentinel.
  if (supplied != null) return supplied.trim() || null;
  let value = payload;
  if (needsPreview(preview) && jsonEncoded && typeof payload === 'string') {
    try {
      value = JSON.parse(payload);
    } catch {
      value = null;
    }
  }
  return storedPreview(supplied, value, jsonEncoded && typeof payload === 'string' ? payload : undefined) || null;
}

/** Older response builders may shorten previews or turn empty strings into null. */
export function buildSpanQueryResponse(...args: Parameters<typeof coreStorage.buildSpanQueryResponse>) {
  const [plan, selected, payloads, metrics = []] = args;
  // Older core validates rows strictly, so do not pass newly added or adapter-only fields.
  const compatibleSelected = coreStorage.SPAN_QUERY_FIELD_REGISTRY
    ? selected
    : (selected.map(row => ({
        organizationId: row.organizationId,
        resourceId: row.resourceId,
        traceId: row.traceId,
        spanId: row.spanId,
        parentSpanId: row.parentSpanId,
        name: row.name,
        spanType: row.spanType,
        status: row.status,
        startedAt: row.startedAt,
        endedAt: row.endedAt,
        durationMs: row.durationMs,
        entityType: row.entityType,
        entityId: row.entityId,
        entityName: row.entityName,
        model: row.model,
        provider: row.provider,
      })) as typeof selected);
  // Older core builders require metrics to preserve their cost response contract.
  if (canGeneratePreviews) return coreStorage.buildSpanQueryResponse(plan, compatibleSelected, payloads, metrics);
  const response = coreStorage.buildSpanQueryResponse(plan, compatibleSelected, [], metrics);
  const byIdentity = new Map(payloads.map(payload => [coreStorage.spanQueryIdentityKey(payload), payload]));
  for (const span of response.spans) {
    const payload = byIdentity.get(coreStorage.spanQueryIdentityKey(span));
    span.inputPreview = payload?.inputPreview ?? null;
    span.outputPreview = payload?.outputPreview ?? null;
    span.errorPreview = payload?.errorPreview ?? null;
  }
  return response;
}
