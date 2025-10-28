import type { AITraceRecord, AITracesPaginatedArg, WorkflowInfo } from '@mastra/core';
import type { ServerDetailInfo } from '@mastra/core/mcp';
import type { RuntimeContext } from '@mastra/core/runtime-context';
import {
  Agent,
  MemoryThread,
  Tool,
  Workflow,
  Vector,
  BaseResource,
  A2A,
  MCPTool,
  AgentBuilder,
  Observability,
} from './resources';
import type {
  ClientOptions,
  CreateMemoryThreadParams,
  CreateMemoryThreadResponse,
  GetAgentResponse,
  GetLogParams,
  GetLogsParams,
  GetLogsResponse,
  GetMemoryThreadParams,
  GetMemoryThreadResponse,
  GetToolResponse,
  GetWorkflowResponse,
  SaveMessageToMemoryParams,
  SaveMessageToMemoryResponse,
  McpServerListResponse,
  McpServerToolListResponse,
  GetScorerResponse,
  GetScoresByScorerIdParams,
  GetScoresResponse,
  GetScoresByRunIdParams,
  GetScoresByEntityIdParams,
  GetScoresBySpanParams,
  SaveScoreParams,
  SaveScoreResponse,
  GetAITracesResponse,
  GetMemoryConfigParams,
  GetMemoryConfigResponse,
  GetMemoryThreadMessagesResponse,
  MemorySearchResponse,
  GetAgentsModelProvidersResponse,
} from './types';
import { base64RuntimeContext, parseClientRuntimeContext, runtimeContextQueryString } from './utils';

export class MastraClient extends BaseResource {
  private observability: Observability;
  constructor(options: ClientOptions) {
    super(options);
    this.observability = new Observability(options);
  }

  /**
   * Retrieves all available agents
   * @param runtimeContext - Optional runtime context to pass as query parameter
   * @returns Promise containing map of agent IDs to agent details
   */
  public getAgents(runtimeContext?: RuntimeContext | Record<string, any>): Promise<Record<string, GetAgentResponse>> {
    const runtimeContextParam = base64RuntimeContext(parseClientRuntimeContext(runtimeContext));

    const searchParams = new URLSearchParams();

    if (runtimeContextParam) {
      searchParams.set('runtimeContext', runtimeContextParam);
    }

    const queryString = searchParams.toString();
    return this.request(`/api/agents${queryString ? `?${queryString}` : ''}`);
  }

  public getAgentsModelProviders(): Promise<GetAgentsModelProvidersResponse> {
    return this.request(`/api/agents/providers`);
  }

  /**
   * Gets an agent instance by ID
   * @param agentId - ID of the agent to retrieve
   * @returns Agent instance
   */
  public getAgent(agentId: string) {
    return new Agent(this.options, agentId);
  }

  /**
   * Retrieves memory threads for a resource
   * @param params - Parameters containing the resource ID and optional runtime context
   * @returns Promise containing array of memory threads
   */
  public getMemoryThreads(params: GetMemoryThreadParams): Promise<GetMemoryThreadResponse> {
    return this.request(
      `/api/memory/threads?resourceid=${params.resourceId}&agentId=${params.agentId}${runtimeContextQueryString(params.runtimeContext, '&')}`,
    );
  }

  /**
   * Retrieves memory config for a resource
   * @param params - Parameters containing the resource ID and optional runtime context
   * @returns Promise containing memory configuration
   */
  public getMemoryConfig(params: GetMemoryConfigParams): Promise<GetMemoryConfigResponse> {
    return this.request(
      `/api/memory/config?agentId=${params.agentId}${runtimeContextQueryString(params.runtimeContext, '&')}`,
    );
  }

  /**
   * Creates a new memory thread
   * @param params - Parameters for creating the memory thread including optional runtime context
   * @returns Promise containing the created memory thread
   */
  public createMemoryThread(params: CreateMemoryThreadParams): Promise<CreateMemoryThreadResponse> {
    return this.request(
      `/api/memory/threads?agentId=${params.agentId}${runtimeContextQueryString(params.runtimeContext, '&')}`,
      { method: 'POST', body: params },
    );
  }

  /**
   * Gets a memory thread instance by ID
   * @param threadId - ID of the memory thread to retrieve
   * @returns MemoryThread instance
   */
  public getMemoryThread({ threadId, agentId }: { threadId: string; agentId: string }) {
    return new MemoryThread(this.options, threadId, agentId);
  }

  /**
   * Saves messages to memory
   * @param params - Parameters containing messages to save and optional runtime context
   * @returns Promise containing the saved messages
   */
  public saveMessageToMemory(params: SaveMessageToMemoryParams): Promise<SaveMessageToMemoryResponse> {
    return this.request(
      `/api/memory/save-messages?agentId=${params.agentId}${runtimeContextQueryString(params.runtimeContext, '&')}`,
      {
        method: 'POST',
        body: params,
      },
    );
  }

  /**
   * Gets the status of the memory system
   * @param agentId - The agent ID
   * @param runtimeContext - Optional runtime context to pass as query parameter
   * @returns Promise containing memory system status
   */
  public getMemoryStatus(
    agentId: string,
    runtimeContext?: RuntimeContext | Record<string, any>,
  ): Promise<{ result: boolean }> {
    return this.request(`/api/memory/status?agentId=${agentId}${runtimeContextQueryString(runtimeContext, '&')}`);
  }

  /**
   * Retrieves all available tools
   * @param runtimeContext - Optional runtime context to pass as query parameter
   * @returns Promise containing map of tool IDs to tool details
   */
  public getTools(runtimeContext?: RuntimeContext | Record<string, any>): Promise<Record<string, GetToolResponse>> {
    const runtimeContextParam = base64RuntimeContext(parseClientRuntimeContext(runtimeContext));

    const searchParams = new URLSearchParams();

    if (runtimeContextParam) {
      searchParams.set('runtimeContext', runtimeContextParam);
    }

    const queryString = searchParams.toString();
    return this.request(`/api/tools${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Gets a tool instance by ID
   * @param toolId - ID of the tool to retrieve
   * @returns Tool instance
   */
  public getTool(toolId: string) {
    return new Tool(this.options, toolId);
  }

  /**
   * Retrieves all available workflows
   * @param runtimeContext - Optional runtime context to pass as query parameter
   * @returns Promise containing map of workflow IDs to workflow details
   */
  public getWorkflows(
    runtimeContext?: RuntimeContext | Record<string, any>,
  ): Promise<Record<string, GetWorkflowResponse>> {
    const runtimeContextParam = base64RuntimeContext(parseClientRuntimeContext(runtimeContext));

    const searchParams = new URLSearchParams();

    if (runtimeContextParam) {
      searchParams.set('runtimeContext', runtimeContextParam);
    }

    const queryString = searchParams.toString();
    return this.request(`/api/workflows${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Gets a workflow instance by ID
   * @param workflowId - ID of the workflow to retrieve
   * @returns Workflow instance
   */
  public getWorkflow(workflowId: string) {
    return new Workflow(this.options, workflowId);
  }

  /**
   * Gets all available agent builder actions
   * @returns Promise containing map of action IDs to action details
   */
  public getAgentBuilderActions(): Promise<Record<string, WorkflowInfo>> {
    return this.request('/api/agent-builder/');
  }

  /**
   * Gets an agent builder instance for executing agent-builder workflows
   * @returns AgentBuilder instance
   */
  public getAgentBuilderAction(actionId: string) {
    return new AgentBuilder(this.options, actionId);
  }

  /**
   * Gets a vector instance by name
   * @param vectorName - Name of the vector to retrieve
   * @returns Vector instance
   */
  public getVector(vectorName: string) {
    return new Vector(this.options, vectorName);
  }

  /**
   * Retrieves logs
   * @param params - Parameters for filtering logs
   * @returns Promise containing array of log messages
   */
  public getLogs(params: GetLogsParams): Promise<GetLogsResponse> {
    const { transportId, fromDate, toDate, logLevel, filters, page, perPage } = params;
    const _filters = filters ? Object.entries(filters).map(([key, value]) => `${key}:${value}`) : [];

    const searchParams = new URLSearchParams();
    if (transportId) {
      searchParams.set('transportId', transportId);
    }
    if (fromDate) {
      searchParams.set('fromDate', fromDate.toISOString());
    }
    if (toDate) {
      searchParams.set('toDate', toDate.toISOString());
    }
    if (logLevel) {
      searchParams.set('logLevel', logLevel);
    }
    if (page) {
      searchParams.set('page', String(page));
    }
    if (perPage) {
      searchParams.set('perPage', String(perPage));
    }
    if (_filters) {
      if (Array.isArray(_filters)) {
        for (const filter of _filters) {
          searchParams.append('filters', filter);
        }
      } else {
        searchParams.set('filters', _filters);
      }
    }

    if (searchParams.size) {
      return this.request(`/api/logs?${searchParams}`);
    } else {
      return this.request(`/api/logs`);
    }
  }

  /**
   * Gets logs for a specific run
   * @param params - Parameters containing run ID to retrieve
   * @returns Promise containing array of log messages
   */
  public getLogForRun(params: GetLogParams): Promise<GetLogsResponse> {
    const { runId, transportId, fromDate, toDate, logLevel, filters, page, perPage } = params;

    const _filters = filters ? Object.entries(filters).map(([key, value]) => `${key}:${value}`) : [];
    const searchParams = new URLSearchParams();
    if (runId) {
      searchParams.set('runId', runId);
    }
    if (transportId) {
      searchParams.set('transportId', transportId);
    }
    if (fromDate) {
      searchParams.set('fromDate', fromDate.toISOString());
    }
    if (toDate) {
      searchParams.set('toDate', toDate.toISOString());
    }
    if (logLevel) {
      searchParams.set('logLevel', logLevel);
    }
    if (page) {
      searchParams.set('page', String(page));
    }
    if (perPage) {
      searchParams.set('perPage', String(perPage));
    }

    if (_filters) {
      if (Array.isArray(_filters)) {
        for (const filter of _filters) {
          searchParams.append('filters', filter);
        }
      } else {
        searchParams.set('filters', _filters);
      }
    }

    if (searchParams.size) {
      return this.request(`/api/logs/${runId}?${searchParams}`);
    } else {
      return this.request(`/api/logs/${runId}`);
    }
  }

  /**
   * List of all log transports
   * @returns Promise containing list of log transports
   */
  public getLogTransports(): Promise<{ transports: string[] }> {
    return this.request('/api/logs/transports');
  }

  /**
   * Retrieves a list of available MCP servers.
   * @param params - Optional parameters for pagination (limit, offset).
   * @returns Promise containing the list of MCP servers and pagination info.
   */
  public getMcpServers(params?: { limit?: number; offset?: number }): Promise<McpServerListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.limit !== undefined) {
      searchParams.set('limit', String(params.limit));
    }
    if (params?.offset !== undefined) {
      searchParams.set('offset', String(params.offset));
    }
    const queryString = searchParams.toString();
    return this.request(`/api/mcp/v0/servers${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Retrieves detailed information for a specific MCP server.
   * @param serverId - The ID of the MCP server to retrieve.
   * @param params - Optional parameters, e.g., specific version.
   * @returns Promise containing the detailed MCP server information.
   */
  public getMcpServerDetails(serverId: string, params?: { version?: string }): Promise<ServerDetailInfo> {
    const searchParams = new URLSearchParams();
    if (params?.version) {
      searchParams.set('version', params.version);
    }
    const queryString = searchParams.toString();
    return this.request(`/api/mcp/v0/servers/${serverId}${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Retrieves a list of tools for a specific MCP server.
   * @param serverId - The ID of the MCP server.
   * @returns Promise containing the list of tools.
   */
  public getMcpServerTools(serverId: string): Promise<McpServerToolListResponse> {
    return this.request(`/api/mcp/${serverId}/tools`);
  }

  /**
   * Gets an MCPTool resource instance for a specific tool on an MCP server.
   * This instance can then be used to fetch details or execute the tool.
   * @param serverId - The ID of the MCP server.
   * @param toolId - The ID of the tool.
   * @returns MCPTool instance.
   */
  public getMcpServerTool(serverId: string, toolId: string): MCPTool {
    return new MCPTool(this.options, serverId, toolId);
  }

  /**
   * Gets an A2A client for interacting with an agent via the A2A protocol
   * @param agentId - ID of the agent to interact with
   * @returns A2A client instance
   */
  public getA2A(agentId: string) {
    return new A2A(this.options, agentId);
  }

  /**
   * Retrieves the working memory for a specific thread (optionally resource-scoped).
   * @param agentId - ID of the agent.
   * @param threadId - ID of the thread.
   * @param resourceId - Optional ID of the resource.
   * @returns Working memory for the specified thread or resource.
   */
  public getWorkingMemory({
    agentId,
    threadId,
    resourceId,
    runtimeContext,
  }: {
    agentId: string;
    threadId: string;
    resourceId?: string;
    runtimeContext?: RuntimeContext | Record<string, any>;
  }) {
    return this.request(
      `/api/memory/threads/${threadId}/working-memory?agentId=${agentId}&resourceId=${resourceId}${runtimeContextQueryString(runtimeContext, '&')}`,
    );
  }

  public searchMemory({
    agentId,
    resourceId,
    threadId,
    searchQuery,
    memoryConfig,
    runtimeContext,
  }: {
    agentId: string;
    resourceId: string;
    threadId?: string;
    searchQuery: string;
    memoryConfig?: any;
    runtimeContext?: RuntimeContext | Record<string, any>;
  }): Promise<MemorySearchResponse> {
    const params = new URLSearchParams({
      searchQuery,
      resourceId,
      agentId,
    });

    if (threadId) {
      params.append('threadId', threadId);
    }

    if (memoryConfig) {
      params.append('memoryConfig', JSON.stringify(memoryConfig));
    }

    return this.request(`/api/memory/search?${params}${runtimeContextQueryString(runtimeContext, '&')}`);
  }

  /**
   * Updates the working memory for a specific thread (optionally resource-scoped).
   * @param agentId - ID of the agent.
   * @param threadId - ID of the thread.
   * @param workingMemory - The new working memory content.
   * @param resourceId - Optional ID of the resource.
   */
  public updateWorkingMemory({
    agentId,
    threadId,
    workingMemory,
    resourceId,
    runtimeContext,
  }: {
    agentId: string;
    threadId: string;
    workingMemory: string;
    resourceId?: string;
    runtimeContext?: RuntimeContext | Record<string, any>;
  }) {
    return this.request(
      `/api/memory/threads/${threadId}/working-memory?agentId=${agentId}${runtimeContextQueryString(runtimeContext, '&')}`,
      {
        method: 'POST',
        body: {
          workingMemory,
          resourceId,
        },
      },
    );
  }

  /**
   * Retrieves all available scorers
   * @returns Promise containing list of available scorers
   */
  public getScorers(): Promise<Record<string, GetScorerResponse>> {
    return this.request('/api/scores/scorers');
  }

  /**
   * Retrieves a scorer by ID
   * @param scorerId - ID of the scorer to retrieve
   * @returns Promise containing the scorer
   */
  public getScorer(scorerId: string): Promise<GetScorerResponse> {
    return this.request(`/api/scores/scorers/${encodeURIComponent(scorerId)}`);
  }

  public getScoresByScorerId(params: GetScoresByScorerIdParams): Promise<GetScoresResponse> {
    const { page, perPage, scorerId, entityId, entityType } = params;
    const searchParams = new URLSearchParams();

    if (entityId) {
      searchParams.set('entityId', entityId);
    }
    if (entityType) {
      searchParams.set('entityType', entityType);
    }

    if (page !== undefined) {
      searchParams.set('page', String(page));
    }
    if (perPage !== undefined) {
      searchParams.set('perPage', String(perPage));
    }
    const queryString = searchParams.toString();
    return this.request(`/api/scores/scorer/${encodeURIComponent(scorerId)}${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Retrieves scores by run ID
   * @param params - Parameters containing run ID and pagination options
   * @returns Promise containing scores and pagination info
   */
  public getScoresByRunId(params: GetScoresByRunIdParams): Promise<GetScoresResponse> {
    const { runId, page, perPage } = params;
    const searchParams = new URLSearchParams();

    if (page !== undefined) {
      searchParams.set('page', String(page));
    }
    if (perPage !== undefined) {
      searchParams.set('perPage', String(perPage));
    }

    const queryString = searchParams.toString();
    return this.request(`/api/scores/run/${encodeURIComponent(runId)}${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Retrieves scores by entity ID and type
   * @param params - Parameters containing entity ID, type, and pagination options
   * @returns Promise containing scores and pagination info
   */
  public getScoresByEntityId(params: GetScoresByEntityIdParams): Promise<GetScoresResponse> {
    const { entityId, entityType, page, perPage } = params;
    const searchParams = new URLSearchParams();

    if (page !== undefined) {
      searchParams.set('page', String(page));
    }
    if (perPage !== undefined) {
      searchParams.set('perPage', String(perPage));
    }

    const queryString = searchParams.toString();
    return this.request(
      `/api/scores/entity/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}${queryString ? `?${queryString}` : ''}`,
    );
  }

  /**
   * Saves a score
   * @param params - Parameters containing the score data to save
   * @returns Promise containing the saved score
   */
  public saveScore(params: SaveScoreParams): Promise<SaveScoreResponse> {
    return this.request('/api/scores', {
      method: 'POST',
      body: params,
    });
  }

  /**
   * Retrieves model providers with available keys
   * @returns Promise containing model providers with available keys
   */
  getModelProviders(): Promise<string[]> {
    return this.request(`/api/model-providers`);
  }

  getAITrace(traceId: string): Promise<AITraceRecord> {
    return this.observability.getTrace(traceId);
  }

  getAITraces(params: AITracesPaginatedArg): Promise<GetAITracesResponse> {
    return this.observability.getTraces(params);
  }

  getScoresBySpan(params: GetScoresBySpanParams): Promise<GetScoresResponse> {
    return this.observability.getScoresBySpan(params);
  }

  score(params: {
    scorerName: string;
    targets: Array<{ traceId: string; spanId?: string }>;
  }): Promise<{ status: string; message: string }> {
    return this.observability.score(params);
  }
}
