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
      path: 'metadata.tenant',
      valueKind: 'string',
      operators: ['eq', 'ne', 'in', 'notIn', 'exists', 'notExists'],
      valueSuggestions: true,
      occurrences: 4,
    },
    {
      path: ['metadata', 'literal.dot'],
      valueKind: 'string',
      operators: ['eq', 'ne', 'in', 'notIn', 'exists', 'notExists'],
      valueSuggestions: true,
      occurrences: 2,
    },
  ],
  observedFieldsTruncated: false,
};

export const traceQueryValuesFixture: GetTraceQueryValuesResponse = {
  values: [
    { value: 'eu-west', count: 8 },
    { value: 'us-east', count: 4 },
    { value: 3, count: 2 },
    { value: true, count: 1 },
  ],
  valuesTruncated: false,
};
