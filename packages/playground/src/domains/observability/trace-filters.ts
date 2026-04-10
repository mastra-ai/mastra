import type { ListTracesArgs } from '@mastra/core/storage';
import type { PropertyFilterField, PropertyFilterToken, TraceStatusFilter } from '@mastra/playground-ui';

export const TRACE_ROOT_ENTITY_TYPE_PARAM = 'rootEntityType';
export const TRACE_STATUS_PARAM = 'status';

export const TRACE_PROPERTY_FILTER_PARAM_BY_FIELD = {
  tags: 'filterTags',
  entityName: 'filterEntityName',
  traceId: 'filterTraceId',
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

export const TRACE_PROPERTY_FILTER_FIELD_IDS = Object.keys(TRACE_PROPERTY_FILTER_PARAM_BY_FIELD) as Array<
  keyof typeof TRACE_PROPERTY_FILTER_PARAM_BY_FIELD
>;

export const TRACE_STATUS_VALUES = new Set<TraceStatusFilter>(['running', 'success', 'error']);

export function createTracePropertyFilterFields(availableTags: string[]): PropertyFilterField[] {
  return [
    {
      id: 'tags',
      label: 'Tags',
      kind: 'multi-select',
      options: availableTags.map(tag => ({ label: tag, value: tag })),
      placeholder: 'Choose tags',
      emptyText: 'No tags found.',
    },
    { id: 'entityName', label: 'Root Entity Name', kind: 'text', supportsSuggestions: true },
    { id: 'traceId', label: 'Trace ID', kind: 'text' },
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

export function getTracePropertyFilterTokens(searchParams: URLSearchParams): PropertyFilterToken[] {
  const tokens: PropertyFilterToken[] = [];

  for (const fieldId of TRACE_PROPERTY_FILTER_FIELD_IDS) {
    const param = TRACE_PROPERTY_FILTER_PARAM_BY_FIELD[fieldId];

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

export function getPreservedTraceFilterParams(searchParams: URLSearchParams) {
  const next = new URLSearchParams();

  const rootEntityType = searchParams.get(TRACE_ROOT_ENTITY_TYPE_PARAM);
  if (rootEntityType) next.set(TRACE_ROOT_ENTITY_TYPE_PARAM, rootEntityType);

  const status = searchParams.get(TRACE_STATUS_PARAM);
  if (status) next.set(TRACE_STATUS_PARAM, status);

  for (const fieldId of TRACE_PROPERTY_FILTER_FIELD_IDS) {
    const param = TRACE_PROPERTY_FILTER_PARAM_BY_FIELD[fieldId];
    if (fieldId === 'tags') {
      for (const value of searchParams.getAll(param)) {
        next.append(param, value);
      }
      continue;
    }

    const value = searchParams.get(param);
    if (value) {
      next.set(param, value);
    }
  }

  return next;
}

export function applyTracePropertyFilterTokens(params: URLSearchParams, tokens: PropertyFilterToken[]) {
  for (const fieldId of TRACE_PROPERTY_FILTER_FIELD_IDS) {
    params.delete(TRACE_PROPERTY_FILTER_PARAM_BY_FIELD[fieldId]);
  }

  for (const token of tokens) {
    const param =
      TRACE_PROPERTY_FILTER_PARAM_BY_FIELD[token.fieldId as keyof typeof TRACE_PROPERTY_FILTER_PARAM_BY_FIELD];
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

export function buildTraceListFilters({
  rootEntityType,
  status,
  dateFrom,
  dateTo,
  tokens,
}: {
  rootEntityType?: string;
  status?: TraceStatusFilter;
  dateFrom?: Date;
  dateTo?: Date;
  tokens: PropertyFilterToken[];
}): ListTracesArgs['filters'] {
  const filters: NonNullable<ListTracesArgs['filters']> = {};

  if (rootEntityType) {
    filters.entityType = rootEntityType as NonNullable<ListTracesArgs['filters']>['entityType'];
  }

  if (status) {
    filters.status = status;
  }

  if (dateFrom) {
    filters.startedAt = { start: dateFrom };
  }

  if (dateTo) {
    filters.endedAt = { end: dateTo };
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
      case 'entityName':
        filters.entityName = token.value;
        break;
      case 'traceId':
        filters.traceId = token.value;
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
