export interface DatasetSchemas {
  inputSchema: Record<string, unknown> | null;
  outputSchema: Record<string, unknown> | null;
  requestContextSchema: Record<string, unknown> | null;
}

export const EMPTY_SCHEMAS: DatasetSchemas = { inputSchema: null, outputSchema: null, requestContextSchema: null };
