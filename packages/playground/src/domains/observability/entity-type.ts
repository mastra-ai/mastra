import type { EntityType as CoreEntityType } from '@mastra/core/observability';

export const EntityType = {
  AGENT: 'agent' as CoreEntityType,
  TOOL: 'tool' as CoreEntityType,
  WORKFLOW_RUN: 'workflow_run' as CoreEntityType,
} as const;

export type EntityType = CoreEntityType;
