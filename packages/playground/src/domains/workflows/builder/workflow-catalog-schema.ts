import type { WorkflowDraftStepSchema } from './workflow-draft';

type WorkflowCatalogSchema = WorkflowDraftStepSchema['inputSchema'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseWorkflowCatalogSchema(schema: string | undefined): WorkflowCatalogSchema | undefined {
  if (!schema) return undefined;

  try {
    const parsed: unknown = JSON.parse(schema);
    if (!isRecord(parsed)) return undefined;

    return isRecord(parsed.json) ? parsed.json : parsed;
  } catch {
    return undefined;
  }
}
