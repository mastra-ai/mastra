import { useMemo } from 'react';
import { createEntityLearningService } from '../services';
import type { EntityLearningService } from '../services';

type EntityLearningWindow = Window &
  typeof globalThis & {
    MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT?: string;
    MASTRA_ORGANIZATION_ID?: string;
    MASTRA_PLATFORM_PROJECT_ID?: string;
  };

export type EntityLearningConfig = {
  baseUrl?: string;
  organizationId?: string;
  projectId?: string;
  isConfigured: boolean;
  service: EntityLearningService | null;
};

/**
 * The injected observability endpoint is the trace-ingest URL (e.g.
 * `https://observability.mastra.ai/v1/traces`). Agent Learning lives on the
 * same origin under `/api/learning`, so strip the path down to the origin.
 * Falls back to the raw value when it isn't an absolute URL (e.g. tests or
 * proxy-relative setups).
 */
function toQueryServiceOrigin(endpoint: string): string {
  try {
    return new URL(endpoint).origin;
  } catch {
    return endpoint;
  }
}

/**
 * Reads the server-injected platform observability config from `window` and
 * memoizes a configured Entity-Learning service. Returns `service: null` when
 * the observability endpoint is not configured, so callers can gate queries.
 */
export function useEntityLearningConfig(): EntityLearningConfig {
  const w = typeof window === 'undefined' ? undefined : (window as EntityLearningWindow);
  const observabilityEndpoint = w?.MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT || undefined;
  const baseUrl = observabilityEndpoint ? toQueryServiceOrigin(observabilityEndpoint) : undefined;
  const organizationId = w?.MASTRA_ORGANIZATION_ID || undefined;
  const projectId = w?.MASTRA_PLATFORM_PROJECT_ID || undefined;

  const service = useMemo(() => {
    if (!baseUrl) return null;
    return createEntityLearningService({ baseUrl, projectId });
  }, [baseUrl, projectId]);

  return {
    baseUrl,
    organizationId,
    projectId,
    isConfigured: Boolean(baseUrl),
    service,
  };
}
