import type { RequestContext } from '@mastra/core/di';
import { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY } from '@mastra/core/request-context';
import { HTTPException } from '../http-exception';

// Validation helper
export function validateBody(body: Record<string, unknown>) {
  const errorResponse = Object.entries(body).reduce<Record<string, string>>((acc, [key, value]) => {
    if (!value) {
      acc[key] = `Argument "${key}" is required`;
    }
    return acc;
  }, {});

  if (Object.keys(errorResponse).length > 0) {
    throw new HTTPException(400, { message: Object.values(errorResponse)[0] });
  }
}

/**
 * sanitizes the body by removing disallowed keys.
 * @param body body to sanitize
 * @param disallowedKeys keys to remove from the body
 */
export function sanitizeBody(body: Record<string, unknown>, disallowedKeys: string[]) {
  for (const key of disallowedKeys) {
    if (key in body) {
      delete body[key];
    }
  }
}

export function parsePerPage(
  value: string | undefined,
  defaultValue: number = 100,
  max: number = 1000,
): number | false {
  const normalized = (value || '').trim().toLowerCase();
  // Handle explicit false to bypass pagination
  if (normalized === 'false') {
    return false;
  }
  const parsed = parseInt(value || String(defaultValue), 10);
  if (isNaN(parsed)) return defaultValue;
  return Math.min(max, Math.max(1, parsed));
}

/**
 * Parses filter query parameters into a key-value object.
 */
export function parseFilters(filters: string | string[] | undefined): Record<string, string> | undefined {
  if (!filters) return undefined;

  return Object.fromEntries(
    (Array.isArray(filters) ? filters : [filters]).map((attr: string) => {
      const [key, ...valueParts] = attr.split(':');
      const value = valueParts.join(':'); // ✅ Handles colons in values
      return [key, value];
    }),
  );
}

// ============================================================================
// Authorization Utilities
// ============================================================================

/**
 * Gets the effective resourceId, preferring the reserved key from requestContext
 * over client-provided values for security.
 */
export function getEffectiveResourceId(
  requestContext: RequestContext | undefined,
  clientResourceId: string | undefined,
): string | undefined {
  const contextResourceId = requestContext?.get(MASTRA_RESOURCE_ID_KEY) as string | undefined;
  return contextResourceId || clientResourceId;
}

/**
 * Gets the effective threadId, preferring the reserved key from requestContext
 * over client-provided values for security.
 */
export function getEffectiveThreadId(
  requestContext: RequestContext | undefined,
  clientThreadId: string | undefined,
): string | undefined {
  const contextThreadId = requestContext?.get(MASTRA_THREAD_ID_KEY) as string | undefined;
  return contextThreadId || clientThreadId;
}

/**
 * Validates that a thread belongs to the specified resourceId.
 * Throws 403 if the thread exists but belongs to a different resource.
 * Threads with no resourceId are accessible to all (shared threads).
 */
export async function validateThreadOwnership(
  thread: { resourceId?: string | null } | null | undefined,
  effectiveResourceId: string | undefined,
): Promise<void> {
  if (thread && effectiveResourceId && thread.resourceId && thread.resourceId !== effectiveResourceId) {
    throw new HTTPException(403, { message: 'Access denied: thread belongs to a different resource' });
  }
}

/**
 * Validates that a workflow run belongs to the specified resourceId.
 * Throws 403 if the run exists but belongs to a different resource.
 */
export async function validateRunOwnership(
  run: { resourceId?: string | null } | null | undefined,
  effectiveResourceId: string | undefined,
): Promise<void> {
  if (run && effectiveResourceId && run.resourceId && run.resourceId !== effectiveResourceId) {
    throw new HTTPException(403, { message: 'Access denied: workflow run belongs to a different resource' });
  }
}
