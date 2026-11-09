import type { JsonObject } from './use-local-json-object';
import { useLocalJsonObject } from './use-local-json-object';

export type TracingOptionsEntityType = 'agent' | 'workflow';

export function useEntityTracingOptions(
  entityType: TracingOptionsEntityType,
  entityId: string,
): [JsonObject, (next: JsonObject) => void] {
  return useLocalJsonObject(`mastra-tracing-options:${entityType}:${entityId}`);
}
