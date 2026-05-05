import { MASTRA_RESOURCE_ID_KEY } from '@mastra/core/request-context';
import type { ResolveToolProviderToolsOptions } from '@mastra/core/tool-provider';

export function getProviderUserId(options?: ResolveToolProviderToolsOptions): string {
  const resourceId = options?.requestContext?.[MASTRA_RESOURCE_ID_KEY] as string | undefined;
  return resourceId ?? options?.userId ?? 'default';
}
