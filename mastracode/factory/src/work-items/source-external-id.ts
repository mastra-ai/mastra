import type { WorkItemSourceRow } from '../storage/domains/work-items/work-item-schema.js';

/** A source row's external id without the type/workspace scope storage prefixes it with. */
export function sourceExternalId(source: Pick<WorkItemSourceRow, 'sourceType' | 'workspaceId' | 'externalId'>): string {
  const prefix = `${source.sourceType}:${source.workspaceId ? `${source.workspaceId}:` : ''}`;
  return source.externalId.startsWith(prefix) ? source.externalId.slice(prefix.length) : source.externalId;
}
