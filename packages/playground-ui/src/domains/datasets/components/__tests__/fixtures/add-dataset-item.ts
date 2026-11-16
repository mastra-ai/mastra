import type { DatasetItem, DatasetRecord, GetAgentResponse, GetToolResponse } from '@mastra/client-js';
import type { TrajectoryExpectation } from '../../add-dataset-item-dialog/trajectory-types';
import { buildDataset } from './datasets';

export const createdDatasetItem: DatasetItem = {
  id: 'item-1',
  datasetId: 'dataset-1',
  datasetVersion: 1,
  input: { city: 'Seattle' },
  createdAt: '2026-06-16T10:00:00.000Z',
  updatedAt: '2026-06-16T10:00:00.000Z',
};

/** A dataset that runs against nothing in particular: no tools to mock. */
export const untargetedDataset: DatasetRecord = buildDataset();

/** A dataset whose experiments run the weather agent, which has tools. */
export const weatherAgentDataset: DatasetRecord = buildDataset({ targetType: 'agent', targetIds: ['weather-agent'] });

/** A dataset whose experiments run an agent without tools. */
export const toollessAgentDataset: DatasetRecord = buildDataset({ targetType: 'agent', targetIds: ['chat-agent'] });

/** A dataset whose request context is described by a schema, so it renders as a form. */
export const tenantContextDataset: DatasetRecord = buildDataset({
  requestContextSchema: { type: 'object', properties: { tenant: { type: 'string' } } },
});

/** Datasets offered by the picker when the dialog isn't bound to one. */
export const pickableDatasets: DatasetRecord[] = [
  buildDataset({ id: 'dataset-1', name: 'Weather QA' }),
  buildDataset({ id: 'dataset-2', name: 'Support QA' }),
];

/** What the create-dataset flow returns. */
export const freshDataset: DatasetRecord = buildDataset({ id: 'dataset-new', name: 'Fresh dataset' });

/**
 * An expectation recorded from a trace: steps carry fields the structured editor doesn't show (toolResult, success,
 * nested children), which must survive the round-trip.
 */
export const recordedTrajectory: TrajectoryExpectation = {
  ordering: 'strict',
  steps: [
    {
      stepType: 'tool_call',
      name: 'getWeather',
      toolArgs: { city: 'Seattle' },
      toolResult: { temp: 52 },
      success: true,
    },
    { stepType: 'model_generation', name: 'gpt-4o-mini', modelId: 'gpt-4o-mini' },
  ],
};

const agent = (id: string, name: string, tools: GetAgentResponse['tools'] = {}): GetAgentResponse => ({
  id,
  name,
  instructions: '',
  tools,
  workflows: {},
  agents: {},
  skills: [],
  workspaceTools: [],
  browserTools: [],
  hasBrowser: false,
  inputProcessors: [],
  outputProcessors: [],
  provider: 'openai',
  modelId: 'gpt-4o-mini',
  modelVersion: 'v2',
  modelList: undefined,
  defaultOptions: {},
  defaultGenerateOptionsLegacy: {},
  defaultStreamOptionsLegacy: {},
});

const getWeatherTool: GetToolResponse = { id: 'getWeather', description: 'Current weather for a city.' };
const getForecastTool: GetToolResponse = { id: 'getForecast', description: 'Five-day forecast for a city.' };

export const addItemAgents: Record<string, GetAgentResponse> = {
  'weather-agent': agent('weather-agent', 'Weather Agent', {
    getWeather: getWeatherTool,
    getForecast: getForecastTool,
  }),
  'chat-agent': agent('chat-agent', 'Chat Agent'),
};
