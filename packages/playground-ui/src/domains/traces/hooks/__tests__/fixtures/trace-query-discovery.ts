import type { GetTraceQueryFieldsResponse, GetTraceQueryValuesResponse } from '@mastra/client-js';

export const traceQueryFieldsFixture: GetTraceQueryFieldsResponse = {
  canonicalFields: [],
  observedFields: [
    {
      path: 'metadata.region',
      valueKind: 'string',
      operators: ['eq', 'ne', 'in', 'notIn', 'exists', 'notExists'],
      valueSuggestions: true,
      occurrences: 12,
    },
    {
      path: 'metadata.customer.id',
      valueKind: 'string',
      operators: ['eq', 'ne', 'in', 'notIn', 'exists', 'notExists'],
      valueSuggestions: true,
      occurrences: 8,
    },
    {
      path: ['metadata', 'customer.id'],
      valueKind: 'string',
      operators: ['eq', 'ne', 'in', 'notIn', 'exists', 'notExists'],
      valueSuggestions: true,
      occurrences: 6,
    },
    {
      path: 'metadata.retry.count',
      valueKind: 'number',
      operators: ['eq', 'ne', 'in', 'notIn', 'lt', 'lte', 'gt', 'gte', 'exists', 'notExists'],
      valueSuggestions: true,
      occurrences: 4,
    },
    {
      path: 'metadata.flags.reviewed',
      valueKind: 'boolean',
      operators: ['eq', 'ne', 'in', 'notIn', 'exists', 'notExists'],
      valueSuggestions: true,
      occurrences: 4,
    },
    {
      path: 'metadata.mixed',
      valueKind: 'scalar',
      operators: ['eq', 'ne', 'in', 'notIn', 'exists', 'notExists'],
      valueSuggestions: true,
      occurrences: 3,
    },
  ],
  observedFieldsTruncated: false,
};

export const traceQueryValuesFixture: GetTraceQueryValuesResponse = {
  values: [
    { value: 'eu-west', count: 8 },
    { value: 'us-east', count: 4 },
  ],
  valuesTruncated: false,
};
