import type { EntityType } from '@mastra/core/observability';
import type { ListLogsArgs } from '@mastra/core/storage';
import type { LogLevel, PropertyFilterField, PropertyFilterToken } from '@mastra/playground-ui';

export const LOGS_PERIOD_PARAM = 'period';
export const LOGS_LOG_ID_PARAM = 'logId';
export const LOGS_TRACE_ID_PARAM = 'traceId';
export const LOGS_SPAN_ID_PARAM = 'spanId';
export const LOGS_ROOT_ENTITY_TYPE_PARAM = 'rootEntityType';
export const LOGS_LEVEL_PARAM = 'level';

export const LOGS_PROPERTY_FILTER_PARAM_BY_FIELD = {
  tags: 'filterTags',
  entityType: 'filterEntityType',
  entityName: 'filterEntityName',
  rootEntityName: 'filterRootEntityName',
  traceId: 'filterTraceId',
  spanId: 'filterSpanId',
  runId: 'filterRunId',
  threadId: 'filterThreadId',
  sessionId: 'filterSessionId',
  requestId: 'filterRequestId',
  resourceId: 'filterResourceId',
  userId: 'filterUserId',
  organizationId: 'filterOrganizationId',
  serviceName: 'filterServiceName',
  environment: 'filterEnvironment',
  experimentId: 'filterExperimentId',
} as const;

export const LOGS_PROPERTY_FILTER_FIELD_IDS = Object.keys(LOGS_PROPERTY_FILTER_PARAM_BY_FIELD) as Array<
  keyof typeof LOGS_PROPERTY_FILTER_PARAM_BY_FIELD
>;

export const LOG_LEVEL_VALUES = new Set<LogLevel>(['debug', 'info', 'warn', 'error', 'fatal']);

export function createLogsPropertyFilterFields(availableTags: string[]): PropertyFilterField[] {
  return [
    {
      id: 'tags',
      label: 'Tags',
      kind: 'multi-select',
      options: availableTags.map(tag => ({ label: tag, value: tag })),
      placeholder: 'Choose tags',
      emptyText: 'No tags found.',
    },
    { id: 'entityType', label: 'Entity Type', kind: 'text' },
    { id: 'entityName', label: 'Entity Name', kind: 'text', supportsSuggestions: true },
    { id: 'rootEntityName', label: 'Root Entity Name', kind: 'text', supportsSuggestions: true },
    { id: 'traceId', label: 'Trace ID', kind: 'text' },
    { id: 'spanId', label: 'Span ID', kind: 'text' },
    { id: 'runId', label: 'Run ID', kind: 'text' },
    { id: 'threadId', label: 'Thread ID', kind: 'text' },
    { id: 'sessionId', label: 'Session ID', kind: 'text' },
    { id: 'requestId', label: 'Request ID', kind: 'text' },
    { id: 'resourceId', label: 'Resource ID', kind: 'text' },
    { id: 'userId', label: 'User ID', kind: 'text' },
    { id: 'organizationId', label: 'Organization ID', kind: 'text' },
    { id: 'serviceName', label: 'Service Name', kind: 'text', supportsSuggestions: true },
    { id: 'environment', label: 'Environment', kind: 'text', supportsSuggestions: true },
    { id: 'experimentId', label: 'Experiment ID', kind: 'text' },
  ];
}

export function getLogsPropertyFilterTokens(searchParams: URLSearchParams): PropertyFilterToken[] {
  const tokens: PropertyFilterToken[] = [];

  for (const fieldId of LOGS_PROPERTY_FILTER_FIELD_IDS) {
    const param = LOGS_PROPERTY_FILTER_PARAM_BY_FIELD[fieldId];

    if (fieldId === 'tags') {
      const values = searchParams.getAll(param).filter(Boolean);
      if (values.length > 0) {
        tokens.push({ fieldId, value: values });
      }
      continue;
    }

    const value = searchParams.get(param);
    if (value) {
      tokens.push({ fieldId, value });
    }
  }

  return tokens;
}

export function applyLogsPropertyFilterTokens(params: URLSearchParams, tokens: PropertyFilterToken[]) {
  for (const fieldId of LOGS_PROPERTY_FILTER_FIELD_IDS) {
    params.delete(LOGS_PROPERTY_FILTER_PARAM_BY_FIELD[fieldId]);
  }

  for (const token of tokens) {
    const param =
      LOGS_PROPERTY_FILTER_PARAM_BY_FIELD[token.fieldId as keyof typeof LOGS_PROPERTY_FILTER_PARAM_BY_FIELD];
    if (!param) continue;

    if (token.fieldId === 'tags' && Array.isArray(token.value)) {
      for (const value of token.value) {
        params.append(param, value);
      }
      continue;
    }

    if (typeof token.value === 'string' && token.value.trim()) {
      params.set(param, token.value.trim());
    }
  }
}

export function buildLogsListFilters({
  rootEntityType,
  level,
  start,
  tokens,
}: {
  rootEntityType?: EntityType;
  level?: LogLevel;
  start: Date;
  tokens: PropertyFilterToken[];
}): ListLogsArgs['filters'] {
  const filters: NonNullable<ListLogsArgs['filters']> = {
    timestamp: { start },
  };

  if (rootEntityType) {
    filters.rootEntityType = rootEntityType;
  }

  if (level) {
    filters.level = level;
  }

  for (const token of tokens) {
    if (token.fieldId === 'tags') {
      if (Array.isArray(token.value) && token.value.length > 0) {
        filters.tags = token.value;
      }
      continue;
    }

    if (typeof token.value !== 'string') continue;

    switch (token.fieldId) {
      case 'entityType':
        filters.entityType = token.value as EntityType;
        break;
      case 'entityName':
        filters.entityName = token.value;
        break;
      case 'rootEntityName':
        filters.rootEntityName = token.value;
        break;
      case 'traceId':
        filters.traceId = token.value;
        break;
      case 'spanId':
        filters.spanId = token.value;
        break;
      case 'runId':
        filters.runId = token.value;
        break;
      case 'threadId':
        filters.threadId = token.value;
        break;
      case 'sessionId':
        filters.sessionId = token.value;
        break;
      case 'requestId':
        filters.requestId = token.value;
        break;
      case 'resourceId':
        filters.resourceId = token.value;
        break;
      case 'userId':
        filters.userId = token.value;
        break;
      case 'organizationId':
        filters.organizationId = token.value;
        break;
      case 'serviceName':
        filters.serviceName = token.value;
        break;
      case 'environment':
        filters.environment = token.value;
        break;
      case 'experimentId':
        filters.experimentId = token.value;
        break;
      default:
        break;
    }
  }

  return filters;
}
