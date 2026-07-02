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
 * Reads the server-injected platform observability config from `window` and
 * memoizes a configured Entity-Learning service. Returns `service: null` when
 * the observability endpoint is not configured, so callers can gate queries.
 */
export function useEntityLearningConfig(): EntityLearningConfig {
  const w = typeof window === 'undefined' ? undefined : (window as EntityLearningWindow);
  const baseUrl = w?.MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT || undefined;
  const organizationId = w?.MASTRA_ORGANIZATION_ID || undefined;
  const projectId = w?.MASTRA_PLATFORM_PROJECT_ID || undefined;

  const service = useMemo(() => {
    if (!baseUrl) return null;
    return createEntityLearningService({ baseUrl, organizationId, projectId });
  }, [baseUrl, organizationId, projectId]);

  return {
    baseUrl,
    organizationId,
    projectId,
    isConfigured: Boolean(baseUrl),
    service,
  };
}
