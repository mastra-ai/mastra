import type { JsonObject } from '@/domains/run-options/hooks/use-local-json-object';
import { useLocalJsonObject } from '@/domains/run-options/hooks/use-local-json-object';

export type RequestContextEntityType = 'agent' | 'agent-tool' | 'workflow' | 'tool' | 'mcp-tool';

export const getRequestContextStorageKey = (entityType: RequestContextEntityType, entityId: string) =>
  `mastra-request-context:${entityType}:${entityId}`;

export function useEntityRequestContext(
  entityType: RequestContextEntityType,
  entityId: string,
): [JsonObject, (next: JsonObject) => void] {
  return useLocalJsonObject(getRequestContextStorageKey(entityType, entityId));
}
