import { API_ROUTE_METADATA } from './route-metadata.generated.js';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export interface ApiResponseShape {
  kind: 'array' | 'record' | 'object-property' | 'single' | 'unknown';
  listProperty?: string;
  paginationProperty?: string;
}

export interface ApiCommandDescriptor {
  key: string;
  name: string;
  description: string;
  method: HttpMethod;
  path: string;
  positionals: string[];
  acceptsInput: boolean;
  inputRequired: boolean;
  list: boolean;
  responseShape: ApiResponseShape;
  queryParams: string[];
  bodyParams: string[];
  defaultTimeoutMs?: number;
}

interface ApiCommandSpec {
  route: keyof typeof API_ROUTE_METADATA;
  description: string;
  acceptsInput?: boolean;
  inputRequired?: boolean;
  list?: boolean;
  pathParamsFromInput?: string[];
  extraPositionals?: string[];
  defaultTimeoutMs?: number;
}

function defineCommandSpecs<const Specs extends Record<string, ApiCommandSpec>>(specs: Specs): Specs {
  return specs;
}

const API_COMMAND_SPECS = defineCommandSpecs({
  agentList: { route: 'GET /agents', description: 'List available agents', acceptsInput: true, list: true },
  agentGet: { route: 'GET /agents/:agentId', description: 'Get agent details' },
  agentRun: {
    route: 'POST /agents/:agentId/generate',
    description: 'Run an agent with JSON input',
    inputRequired: true,
  },
  workflowList: { route: 'GET /workflows', description: 'List available workflows', acceptsInput: true, list: true },
  workflowGet: { route: 'GET /workflows/:workflowId', description: 'Get workflow details' },
  workflowRunStart: {
    route: 'POST /workflows/:workflowId/start-async',
    description: 'Start a workflow run',
    inputRequired: true,
    defaultTimeoutMs: 120_000,
  },
  workflowRunList: {
    route: 'GET /workflows/:workflowId/runs',
    description: 'List workflow runs',
    acceptsInput: true,
    list: true,
  },
  workflowRunGet: { route: 'GET /workflows/:workflowId/runs/:runId', description: 'Get workflow run details' },
  workflowRunResume: {
    route: 'POST /workflows/:workflowId/resume-async',
    description: 'Resume a suspended workflow run',
    inputRequired: true,
    extraPositionals: ['runId'],
    defaultTimeoutMs: 120_000,
  },
  workflowRunCancel: { route: 'POST /workflows/:workflowId/runs/:runId/cancel', description: 'Cancel a workflow run' },
  toolList: { route: 'GET /tools', description: 'List available tools', acceptsInput: true, list: true },
  toolGet: { route: 'GET /tools/:toolId', description: 'Get tool details and input schema' },
  toolExecute: {
    route: 'POST /tools/:toolId/execute',
    description: 'Execute a tool with JSON input',
    inputRequired: true,
  },
  mcpList: { route: 'GET /mcp/v0/servers', description: 'List MCP servers', acceptsInput: true, list: true },
  mcpGet: { route: 'GET /mcp/v0/servers/:id', description: 'Get MCP server details' },
  mcpToolList: {
    route: 'GET /mcp/:serverId/tools',
    description: 'List tools for an MCP server',
    acceptsInput: true,
    list: true,
  },
  mcpToolGet: { route: 'GET /mcp/:serverId/tools/:toolId', description: 'Get MCP tool details' },
  mcpToolExecute: {
    route: 'POST /mcp/:serverId/tools/:toolId/execute',
    description: 'Execute an MCP tool with JSON input',
    inputRequired: true,
  },
  threadList: { route: 'GET /memory/threads', description: 'List memory threads', acceptsInput: true, list: true },
  threadGet: { route: 'GET /memory/threads/:threadId', description: 'Get thread details' },
  threadCreate: { route: 'POST /memory/threads', description: 'Create a memory thread', inputRequired: true },
  threadUpdate: {
    route: 'PATCH /memory/threads/:threadId',
    description: 'Update a memory thread',
    inputRequired: true,
  },
  threadDelete: {
    route: 'DELETE /memory/threads/:threadId',
    description: 'Delete a memory thread',
    acceptsInput: true,
    inputRequired: true,
  },
  threadMessages: {
    route: 'GET /memory/threads/:threadId/messages',
    description: 'List messages in a memory thread',
    acceptsInput: true,
    list: true,
  },
  memorySearch: {
    route: 'GET /memory/search',
    description: 'Search long-term memory',
    acceptsInput: true,
    inputRequired: true,
    list: true,
  },
  memoryCurrentGet: {
    route: 'GET /memory/threads/:threadId/working-memory',
    description: 'Get current working memory',
    acceptsInput: true,
    inputRequired: true,
    pathParamsFromInput: ['threadId'],
  },
  memoryCurrentUpdate: {
    route: 'POST /memory/threads/:threadId/working-memory',
    description: 'Update current working memory',
    inputRequired: true,
    pathParamsFromInput: ['threadId'],
  },
  memoryStatus: {
    route: 'GET /memory/status',
    description: 'Get memory system status',
    acceptsInput: true,
    inputRequired: true,
  },
  traceList: {
    route: 'GET /observability/traces',
    description: 'List observability traces',
    acceptsInput: true,
    list: true,
  },
  traceGet: { route: 'GET /observability/traces/:traceId', description: 'Get trace details' },
  logList: {
    route: 'GET /observability/logs',
    description: 'List runtime logs',
    acceptsInput: true,
    list: true,
  },
  scoreCreate: { route: 'POST /observability/scores', description: 'Create a score', inputRequired: true },
  scoreList: { route: 'GET /observability/scores', description: 'List scores', acceptsInput: true, list: true },
  scoreGet: { route: 'GET /observability/scores/:scoreId', description: 'Get score details' },
  datasetList: { route: 'GET /datasets', description: 'List datasets', acceptsInput: true, list: true },
  datasetGet: { route: 'GET /datasets/:datasetId', description: 'Get dataset details' },
  datasetCreate: { route: 'POST /datasets', description: 'Create a dataset', inputRequired: true },
  datasetItems: {
    route: 'GET /datasets/:datasetId/items',
    description: 'List dataset items',
    acceptsInput: true,
    list: true,
  },
  experimentList: {
    route: 'GET /datasets/:datasetId/experiments',
    description: 'List dataset experiments',
    acceptsInput: true,
    list: true,
  },
  experimentGet: { route: 'GET /datasets/:datasetId/experiments/:experimentId', description: 'Get experiment details' },
  experimentRun: {
    route: 'POST /datasets/:datasetId/experiments',
    description: 'Run a dataset experiment',
    inputRequired: true,
  },
  experimentResults: {
    route: 'GET /datasets/:datasetId/experiments/:experimentId/results',
    description: 'List experiment results',
    acceptsInput: true,
    list: true,
  },
});

type ApiCommandKey = keyof typeof API_COMMAND_SPECS;

export const API_COMMANDS = Object.fromEntries(
  (Object.entries(API_COMMAND_SPECS) as [ApiCommandKey, ApiCommandSpec][]).map(([key, spec]) => {
    const route = API_ROUTE_METADATA[spec.route];
    const pathParamsFromInput = new Set(spec.pathParamsFromInput ?? []);
    const positionals = [
      ...route.pathParams.filter(param => !pathParamsFromInput.has(param)),
      ...(spec.extraPositionals ?? []),
    ];

    return [
      key,
      {
        key,
        name: key.replace(/[A-Z]/g, letter => ` ${letter.toLowerCase()}`),
        description: spec.description,
        method: route.method as HttpMethod,
        path: route.path,
        positionals,
        acceptsInput: spec.acceptsInput ?? route.hasBody,
        inputRequired: spec.inputRequired ?? false,
        list: spec.list ?? false,
        responseShape: route.responseShape,
        queryParams: [...route.queryParams],
        bodyParams: [...route.bodyParams],
        defaultTimeoutMs: spec.defaultTimeoutMs,
      },
    ];
  }),
) as Record<ApiCommandKey, ApiCommandDescriptor>;
