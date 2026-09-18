import type { GetTraceQueryFieldsResponse, GetTraceQueryValuesResponse } from '@mastra/client-js';

export const metadataFields: GetTraceQueryFieldsResponse = {
  canonicalFields: [],
  observedFields: [
    {
      path: ['metadata', 'customer', 'a.b'],
      valueKind: 'scalar',
      operators: ['eq'],
      valueSuggestions: true,
      occurrences: 3,
    },
  ],
  observedFieldsTruncated: false,
};

export const metadataValues: GetTraceQueryValuesResponse = {
  values: [
    { value: false, count: 1 },
    { value: 0, count: 1 },
    { value: '', count: 1 },
  ],
  valuesTruncated: false,
};
