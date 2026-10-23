import { useDataset } from '@mastra/react/hooks/datasets';
import { useState } from 'react';
import { filledRequestContext, parseRequestContext, toRequestContextSchema } from './request-context';
import type { RequestContextResult } from './request-context';

/**
 * The request context sent with each item: a form when the dataset has a request context schema, a JSON
 * editor otherwise.
 */
export function useRequestContextInput(datasetId: string) {
  const { data: dataset } = useDataset({ datasetId, queryOptions: { enabled: Boolean(datasetId) } });
  const [raw, setRaw] = useState('');
  const [values, setValues] = useState<Record<string, unknown>>({});
  const schema = toRequestContextSchema(dataset?.requestContextSchema);

  const resolve = (): RequestContextResult => {
    if (schema) return filledRequestContext(values);
    return parseRequestContext(raw);
  };

  return {
    schema,
    raw,
    setRaw,
    setValues,
    resetValues: () => setValues({}),
    resolve,
  };
}
