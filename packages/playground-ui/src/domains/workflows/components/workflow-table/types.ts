import type { GetWorkflowResponse } from '@mastra/client-js';

export type WorkflowTableData = GetWorkflowResponse & { id: string };
