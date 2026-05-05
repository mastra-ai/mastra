import { MASTRA_RESOURCE_ID_KEY } from '@mastra/core/request-context';
import type { ResolveToolProviderToolsOptions } from '@mastra/core/tool-provider';

export function getProviderUserId(options?: ResolveToolProviderToolsOptions): string {
  const requestContext = options?.requestContext;
  const resourceId =
    (requestContext?.[MASTRA_RESOURCE_ID_KEY] as string | undefined) ??
    (requestContext?.resourceId as string | undefined);

  return resourceId ?? options?.userId ?? (requestContext?.userId as string | undefined) ?? 'default';
}
