import type { DatasetRecord, GetAgentResponse, GetWorkflowResponse, RouteResponse } from '@mastra/client-js';
import { stringify } from 'superjson';
import { buildDataset } from '../../../__tests__/fixtures/datasets';

export type BatchInsertResponse = RouteResponse<'POST /datasets/:datasetId/items/batch'>;

export const CREATED_DATASET_ID = 'created-dataset';

export const createdDataset: DatasetRecord = buildDataset({ id: CREATED_DATASET_ID, name: 'My dataset' });

export const emptyAgents: Record<string, GetAgentResponse> = {};

export const emptyWorkflows: Record<string, GetWorkflowResponse> = {};

export const WEATHER_WORKFLOW_ID = 'weather-workflow';

/** Schemas are superjson-stringified JSON Schema, as the API returns them. */
export const weatherWorkflow: GetWorkflowResponse = {
  name: 'Weather',
  description: 'Fetches the weather',
  stepGraph: [],
  inputSchema: stringify({ type: 'object', properties: { city: { type: 'string' } } }),
  outputSchema: stringify({ type: 'object', properties: { forecast: { type: 'string' } } }),
  stateSchema: '{}',
  steps: {},
  allSteps: {},
};

export const workflows: Record<string, GetWorkflowResponse> = { [WEATHER_WORKFLOW_ID]: weatherWorkflow };

export const batchInsertResponse: BatchInsertResponse = { items: [], count: 2 };

export const QA_CSV = ['question,answer', 'What is the capital of France?,Paris', 'What is 2 + 2?,4'].join('\n');

export function buildFile(content = QA_CSV, name = 'qa.csv', type = 'text/csv') {
  return new File([content], name, { type });
}
