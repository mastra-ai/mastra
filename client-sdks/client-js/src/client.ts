import type { ListScoresResponse } from '@mastra/core/evals';
import type { ServerDetailInfo } from '@mastra/core/mcp';
import type { RequestContext } from '@mastra/core/request-context';
import type { PaginationInfo, TraceRecord, ListTracesArgs, ListTracesResponse } from '@mastra/core/storage';
import type { WorkflowInfo } from '@mastra/core/workflows';
import {
  Agent,
  MemoryThread,
  Tool,
  Processor,
  Workflow,
  Vector,
  BaseResource,
  A2A,
  MCPTool,
  AgentBuilder,
  Observability,
  StoredAgent,
  StoredMCPClient,
  StoredScorer,
  StoredSkill,
  ToolProvider,
  ProcessorProvider,
  Workspace,
} from './resources';
import type {
  ListScoresBySpanParams,
  LegacyTracesPaginatedArg,
  LegacyGetTracesResponse,
} from './resources/observability';
import type {
  ClientOptions,
  CreateMemoryThreadParams,
  CreateMemoryThreadResponse,
  GetAgentResponse,
  GetLogParams,
  GetLogsParams,
  GetLogsResponse,
  GetToolResponse,
  GetProcessorResponse,
  GetWorkflowResponse,
  SaveMessageToMemoryParams,
  SaveMessageToMemoryResponse,
  McpServerListResponse,
  McpServerToolListResponse,
  GetScorerResponse,
  ListScoresByScorerIdParams,
  ListScoresByRunIdParams,
  ListScoresByEntityIdParams,
  SaveScoreParams,
  SaveScoreResponse,
  GetMemoryConfigParams,
  GetMemoryConfigResponse,
  ListMemoryThreadMessagesResponse,
  MemorySearchResponse,
  ListAgentsModelProvidersResponse,
  ListMemoryThreadsParams,
  ListMemoryThreadsResponse,
  ListStoredAgentsParams,
  ListStoredAgentsResponse,
  CreateStoredAgentParams,
  StoredAgentResponse,
  ListStoredScorersParams,
  ListStoredScorersResponse,
  CreateStoredScorerParams,
  StoredScorerResponse,
  ListStoredMCPClientsParams,
  ListStoredMCPClientsResponse,
  CreateStoredMCPClientParams,
  StoredMCPClientResponse,
  ListStoredSkillsParams,
  ListStoredSkillsResponse,
  CreateStoredSkillParams,
  StoredSkillResponse,
  GetSystemPackagesResponse,
  ListScoresResponse as ListScoresResponseOld,
  GetObservationalMemoryParams,
  GetObservationalMemoryResponse,
  AwaitBufferStatusParams,
  AwaitBufferStatusResponse,
  GetMemoryStatusResponse,
  ListWorkspacesResponse,
  ListVectorsResponse,
  ListEmbeddersResponse,
  DatasetRecord,
  DatasetItem,
  DatasetExperiment,
  DatasetExperimentResult,
  CreateDatasetParams,
  UpdateDatasetParams,
  AddDatasetItemParams,
  UpdateDatasetItemParams,
  BatchInsertDatasetItemsParams,
  BatchDeleteDatasetItemsParams,
  TriggerDatasetExperimentParams,
  CompareExperimentsParams,
  CompareExperimentsResponse,
  DatasetItemVersionResponse,
  DatasetVersionResponse,
  ListToolProvidersResponse,
  GetProcessorProvidersResponse,
} from './types';
import { base64RequestContext, parseClientRequestContext, requestContextQueryString } from './utils';

export class MastraClient extends BaseResource {
  private observability: Observability;
  constructor(options: ClientOptions) {
    super(options);
    this.observability = new Observability(options);
  }

  /**
   * Retrieves all available agents
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing map of agent IDs to agent details
   */
  public listAgents(
    requestContext?: RequestContext | Record<string, any>,
    partial?: boolean,
  ): Promise<Record<string, GetAgentResponse>> {
    const requestContextParam = base64RequestContext(parseClientRequestContext(requestContext));

    const searchParams = new URLSearchParams();

    if (requestContextParam) {
      searchParams.set('requestContext', requestContextParam);
    }

    if (partial) {
      searchParams.set('partial', 'true');
    }

    const queryString = searchParams.toString();
    return this.request(`/agents${queryString ? `?${queryString}` : ''}`);
  }

  public listAgentsModelProviders(): Promise<ListAgentsModelProvidersResponse> {
    return this.request(`/agents/providers`);
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
   * Lists memory threads with optional filtering by resourceId and/or metadata
   * @param params - Parameters containing optional filters, pagination options, and request context
   * @returns Promise containing paginated array of memory threads with metadata
   */
  public async listMemoryThreads(params: ListMemoryThreadsParams = {}): Promise<ListMemoryThreadsResponse> {
    const queryParams = new URLSearchParams();

    // Add resourceId if provided (backwards compatible - also add lowercase version)
    if (params.resourceId) {
      queryParams.set('resourceId', params.resourceId);
    }

    // Add metadata filter as JSON string if provided
    if (params.metadata) {
      queryParams.set('metadata', JSON.stringify(params.metadata));
    }

    if (params.agentId) queryParams.set('agentId', params.agentId);
    if (params.page !== undefined) queryParams.set('page', params.page.toString());
    if (params.perPage !== undefined) queryParams.set('perPage', params.perPage.toString());
    if (params.orderBy) queryParams.set('orderBy', params.orderBy);
    if (params.sortDirection) queryParams.set('sortDirection', params.sortDirection);

    const queryString = queryParams.toString();
    const response: ListMemoryThreadsResponse | ListMemoryThreadsResponse['threads'] = await this.request(
      `/memory/threads${queryString ? `?${queryString}` : ''}${requestContextQueryString(params.requestContext, queryString ? '&' : '?')}`,
    );

    const actualResponse: ListMemoryThreadsResponse =
      'threads' in response
        ? response
        : {
            threads: response,
            total: response.length,
            page: params.page ?? 0,
            perPage: params.perPage ?? 100,
            hasMore: false,
          };

    return actualResponse;
  }

  /**
   * Retrieves memory config for a resource
   * @param params - Parameters containing the resource ID and optional request context
   * @returns Promise containing memory configuration
   */
  public getMemoryConfig(params: GetMemoryConfigParams): Promise<GetMemoryConfigResponse> {
    return this.request(
      `/memory/config?agentId=${params.agentId}${requestContextQueryString(params.requestContext, '&')}`,
    );
  }

  /**
   * Creates a new memory thread
   * @param params - Parameters for creating the memory thread including optional request context
   * @returns Promise containing the created memory thread
   */
  public createMemoryThread(params: CreateMemoryThreadParams): Promise<CreateMemoryThreadResponse> {
    return this.request(
      `/memory/threads?agentId=${params.agentId}${requestContextQueryString(params.requestContext, '&')}`,
      { method: 'POST', body: params },
    );
  }

  /**
   * Gets a memory thread instance by ID
   * @param threadId - ID of the memory thread to retrieve
   * @param agentId - Optional agent ID. When not provided, uses storage directly
   * @returns MemoryThread instance
   */
  public getMemoryThread({ threadId, agentId }: { threadId: string; agentId?: string }) {
    return new MemoryThread(this.options, threadId, agentId);
  }

  /**
   * Lists messages for a thread.
   * @param threadId - ID of the thread
   * @param opts - Optional parameters including agentId, networkId, and requestContext
   *   - When agentId is provided, uses the agent's memory
   *   - When networkId is provided, uses the network endpoint
   *   - When neither is provided, uses storage directly
   * @returns Promise containing the thread messages
   */
  public listThreadMessages(
    threadId: string,
    opts: { agentId?: string; networkId?: string; requestContext?: RequestContext | Record<string, any> } = {},
  ): Promise<ListMemoryThreadMessagesResponse> {
    let url = '';
    if (opts.networkId) {
      url = `/memory/network/threads/${threadId}/messages?networkId=${opts.networkId}${requestContextQueryString(opts.requestContext, '&')}`;
    } else if (opts.agentId) {
      url = `/memory/threads/${threadId}/messages?agentId=${opts.agentId}${requestContextQueryString(opts.requestContext, '&')}`;
    } else {
      url = `/memory/threads/${threadId}/messages${requestContextQueryString(opts.requestContext, '?')}`;
    }
    return this.request(url);
  }

  public deleteThread(
    threadId: string,
    opts: { agentId?: string; networkId?: string; requestContext?: RequestContext | Record<string, any> } = {},
  ): Promise<{ success: boolean; message: string }> {
    let url = '';

    if (opts.agentId) {
      url = `/memory/threads/${threadId}?agentId=${opts.agentId}${requestContextQueryString(opts.requestContext, '&')}`;
    } else if (opts.networkId) {
      url = `/memory/network/threads/${threadId}?networkId=${opts.networkId}${requestContextQueryString(opts.requestContext, '&')}`;
    }
    return this.request(url, { method: 'DELETE' });
  }

  /**
   * Saves messages to memory
   * @param params - Parameters containing messages to save and optional request context
   * @returns Promise containing the saved messages
   */
  public saveMessageToMemory(params: SaveMessageToMemoryParams): Promise<SaveMessageToMemoryResponse> {
    return this.request(
      `/memory/save-messages?agentId=${params.agentId}${requestContextQueryString(params.requestContext, '&')}`,
      {
        method: 'POST',
        body: params,
      },
    );
  }

  /**
   * Gets the status of the memory system
   * @param agentId - The agent ID
   * @param opts - Optional parameters including resourceId, threadId, and requestContext
   * @returns Promise containing memory system status including observational memory info
   */
  public getMemoryStatus(
    agentId: string,
    requestContext?: RequestContext | Record<string, any>,
    opts?: {
      resourceId?: string;
      threadId?: string;
    },
  ): Promise<GetMemoryStatusResponse> {
    const queryParams = new URLSearchParams({ agentId });
    if (opts?.resourceId) queryParams.set('resourceId', opts.resourceId);
    if (opts?.threadId) queryParams.set('threadId', opts.threadId);
    const queryString = queryParams.toString();
    return this.request(`/memory/status?${queryString}${requestContextQueryString(requestContext, '&')}`);
  }

  /**
   * Gets observational memory data for a resource or thread
   * @param params - Parameters containing agentId, resourceId, threadId, and optional request context
   * @returns Promise containing the current OM record and history
   */
  public getObservationalMemory(params: GetObservationalMemoryParams): Promise<GetObservationalMemoryResponse> {
    const queryParams = new URLSearchParams({ agentId: params.agentId });
    if (params.resourceId) queryParams.set('resourceId', params.resourceId);
    if (params.threadId) queryParams.set('threadId', params.threadId);
    const queryString = queryParams.toString();
    return this.request(
      `/memory/observational-memory?${queryString}${requestContextQueryString(params.requestContext, '&')}`,
    );
  }

  /**
   * Blocks until any in-flight observational memory buffering completes, then returns the updated record
   * @param params - Parameters containing agentId, resourceId, threadId
   * @returns Promise containing the updated OM record after buffering completes
   */
  public awaitBufferStatus(params: AwaitBufferStatusParams): Promise<AwaitBufferStatusResponse> {
    return this.request(
      `/memory/observational-memory/buffer-status${requestContextQueryString(params.requestContext)}`,
      {
        method: 'POST',
        body: {
          agentId: params.agentId,
          resourceId: params.resourceId,
          threadId: params.threadId,
        },
      },
    );
  }

  /**
   * Retrieves all available tools
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing map of tool IDs to tool details
   */
  public listTools(requestContext?: RequestContext | Record<string, any>): Promise<Record<string, GetToolResponse>> {
    const requestContextParam = base64RequestContext(parseClientRequestContext(requestContext));

    const searchParams = new URLSearchParams();

    if (requestContextParam) {
      searchParams.set('requestContext', requestContextParam);
    }

    const queryString = searchParams.toString();
    return this.request(`/tools${queryString ? `?${queryString}` : ''}`);
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
   * Retrieves all available processors
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing map of processor IDs to processor details
   */
  public listProcessors(
    requestContext?: RequestContext | Record<string, any>,
  ): Promise<Record<string, GetProcessorResponse>> {
    const requestContextParam = base64RequestContext(parseClientRequestContext(requestContext));

    const searchParams = new URLSearchParams();

    if (requestContextParam) {
      searchParams.set('requestContext', requestContextParam);
    }

    const queryString = searchParams.toString();
    return this.request(`/processors${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Gets a processor instance by ID
   * @param processorId - ID of the processor to retrieve
   * @returns Processor instance
   */
  public getProcessor(processorId: string) {
    return new Processor(this.options, processorId);
  }

  /**
   * Retrieves all available workflows
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing map of workflow IDs to workflow details
   */
  public listWorkflows(
    requestContext?: RequestContext | Record<string, any>,
    partial?: boolean,
  ): Promise<Record<string, GetWorkflowResponse>> {
    const requestContextParam = base64RequestContext(parseClientRequestContext(requestContext));

    const searchParams = new URLSearchParams();

    if (requestContextParam) {
      searchParams.set('requestContext', requestContextParam);
    }

    if (partial) {
      searchParams.set('partial', 'true');
    }

    const queryString = searchParams.toString();
    return this.request(`/workflows${queryString ? `?${queryString}` : ''}`);
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
    return this.request('/agent-builder/');
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
  public listLogs(params: GetLogsParams): Promise<GetLogsResponse> {
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
      return this.request(`/logs?${searchParams}`);
    } else {
      return this.request(`/logs`);
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
      return this.request(`/logs/${runId}?${searchParams}`);
    } else {
      return this.request(`/logs/${runId}`);
    }
  }

  /**
   * List of all log transports
   * @returns Promise containing list of log transports
   */
  public listLogTransports(): Promise<{ transports: string[] }> {
    return this.request('/logs/transports');
  }

  /**
   * Retrieves a list of available MCP servers.
   * @param params - Optional parameters for pagination (page, perPage, or deprecated offset, limit).
   * @returns Promise containing the list of MCP servers and pagination info.
   */
  public getMcpServers(params?: {
    page?: number;
    perPage?: number;
    /** @deprecated Use page instead */
    offset?: number;
    /** @deprecated Use perPage instead */
    limit?: number;
  }): Promise<McpServerListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.page !== undefined) {
      searchParams.set('page', String(params.page));
    }
    if (params?.perPage !== undefined) {
      searchParams.set('perPage', String(params.perPage));
    }
    // Legacy support: also send limit/offset if provided (for older servers)
    if (params?.limit !== undefined) {
      searchParams.set('limit', String(params.limit));
    }
    if (params?.offset !== undefined) {
      searchParams.set('offset', String(params.offset));
    }
    const queryString = searchParams.toString();
    return this.request(`/mcp/v0/servers${queryString ? `?${queryString}` : ''}`);
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
    return this.request(`/mcp/v0/servers/${serverId}${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Retrieves a list of tools for a specific MCP server.
   * @param serverId - The ID of the MCP server.
   * @returns Promise containing the list of tools.
   */
  public getMcpServerTools(serverId: string): Promise<McpServerToolListResponse> {
    return this.request(`/mcp/${serverId}/tools`);
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
    requestContext,
  }: {
    agentId: string;
    threadId: string;
    resourceId?: string;
    requestContext?: RequestContext | Record<string, any>;
  }) {
    return this.request(
      `/memory/threads/${threadId}/working-memory?agentId=${agentId}&resourceId=${resourceId}${requestContextQueryString(requestContext, '&')}`,
    );
  }

  public searchMemory({
    agentId,
    resourceId,
    threadId,
    searchQuery,
    memoryConfig,
    requestContext,
  }: {
    agentId: string;
    resourceId: string;
    threadId?: string;
    searchQuery: string;
    memoryConfig?: any;
    requestContext?: RequestContext | Record<string, any>;
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

    return this.request(`/memory/search?${params}${requestContextQueryString(requestContext, '&')}`);
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
    requestContext,
  }: {
    agentId: string;
    threadId: string;
    workingMemory: string;
    resourceId?: string;
    requestContext?: RequestContext | Record<string, any>;
  }) {
    return this.request(
      `/memory/threads/${threadId}/working-memory?agentId=${agentId}${requestContextQueryString(requestContext, '&')}`,
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
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing list of available scorers
   */
  public listScorers(
    requestContext?: RequestContext | Record<string, any>,
  ): Promise<Record<string, GetScorerResponse>> {
    return this.request(`/scores/scorers${requestContextQueryString(requestContext)}`);
  }

  /**
   * Retrieves a scorer by ID
   * @param scorerId - ID of the scorer to retrieve
   * @returns Promise containing the scorer
   */
  public getScorer(scorerId: string): Promise<GetScorerResponse> {
    return this.request(`/scores/scorers/${encodeURIComponent(scorerId)}`);
  }

  public listScoresByScorerId(params: ListScoresByScorerIdParams): Promise<ListScoresResponseOld> {
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
    return this.request(`/scores/scorer/${encodeURIComponent(scorerId)}${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Retrieves scores by run ID
   * @param params - Parameters containing run ID and pagination options
   * @returns Promise containing scores and pagination info
   */
  public listScoresByRunId(params: ListScoresByRunIdParams): Promise<ListScoresResponseOld> {
    const { runId, page, perPage } = params;
    const searchParams = new URLSearchParams();

    if (page !== undefined) {
      searchParams.set('page', String(page));
    }
    if (perPage !== undefined) {
      searchParams.set('perPage', String(perPage));
    }

    const queryString = searchParams.toString();
    return this.request(`/scores/run/${encodeURIComponent(runId)}${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Retrieves scores by entity ID and type
   * @param params - Parameters containing entity ID, type, and pagination options
   * @returns Promise containing scores and pagination info
   */
  public listScoresByEntityId(params: ListScoresByEntityIdParams): Promise<ListScoresResponseOld> {
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
      `/scores/entity/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}${queryString ? `?${queryString}` : ''}`,
    );
  }

  /**
   * Saves a score
   * @param params - Parameters containing the score data to save
   * @returns Promise containing the saved score
   */
  public saveScore(params: SaveScoreParams): Promise<SaveScoreResponse> {
    return this.request('/scores', {
      method: 'POST',
      body: params,
    });
  }

  getTrace(traceId: string): Promise<TraceRecord> {
    return this.observability.getTrace(traceId);
  }

  /**
   * Retrieves paginated list of traces with optional filtering.
   * This is the legacy API preserved for backward compatibility.
   *
   * @param params - Parameters for pagination and filtering (legacy format)
   * @returns Promise containing paginated traces and pagination info
   * @deprecated Use {@link listTraces} instead for new features like ordering and more filters.
   */
  getTraces(params: LegacyTracesPaginatedArg): Promise<LegacyGetTracesResponse> {
    return this.observability.getTraces(params);
  }

  /**
   * Retrieves paginated list of traces with optional filtering and sorting.
   * This is the new API with improved filtering options.
   *
   * @param params - Parameters for pagination, filtering, and ordering
   * @returns Promise containing paginated traces and pagination info
   */
  listTraces(params: ListTracesArgs = {}): Promise<ListTracesResponse> {
    return this.observability.listTraces(params);
  }

  listScoresBySpan(params: ListScoresBySpanParams): Promise<ListScoresResponse> {
    return this.observability.listScoresBySpan(params);
  }

  score(params: {
    scorerName: string;
    targets: Array<{ traceId: string; spanId?: string }>;
  }): Promise<{ status: string; message: string }> {
    return this.observability.score(params);
  }

  // ============================================================================
  // Stored Agents
  // ============================================================================

  /**
   * Lists all stored agents with optional pagination
   * @param params - Optional pagination and ordering parameters
   * @returns Promise containing paginated list of stored agents
   */
  public listStoredAgents(params?: ListStoredAgentsParams): Promise<ListStoredAgentsResponse> {
    const searchParams = new URLSearchParams();

    if (params?.page !== undefined) {
      searchParams.set('page', String(params.page));
    }
    if (params?.perPage !== undefined) {
      searchParams.set('perPage', String(params.perPage));
    }
    if (params?.orderBy) {
      if (params.orderBy.field) {
        searchParams.set('orderBy[field]', params.orderBy.field);
      }
      if (params.orderBy.direction) {
        searchParams.set('orderBy[direction]', params.orderBy.direction);
      }
    }
    if (params?.authorId) {
      searchParams.set('authorId', params.authorId);
    }
    if (params?.metadata) {
      searchParams.set('metadata', JSON.stringify(params.metadata));
    }

    const queryString = searchParams.toString();
    return this.request(`/stored/agents${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Creates a new stored agent
   * @param params - Agent configuration including id, name, instructions, model, etc.
   * @returns Promise containing the created stored agent
   */
  public createStoredAgent(params: CreateStoredAgentParams): Promise<StoredAgentResponse> {
    return this.request('/stored/agents', {
      method: 'POST',
      body: params,
    });
  }

  /**
   * Gets a stored agent instance by ID for further operations (details, update, delete)
   * @param storedAgentId - ID of the stored agent to retrieve
   * @returns StoredAgent instance
   */
  public getStoredAgent(storedAgentId: string): StoredAgent {
    return new StoredAgent(this.options, storedAgentId);
  }

  // ============================================================================
  // Stored Scorer Definitions
  // ============================================================================

  /**
   * Lists all stored scorer definitions with optional pagination
   * @param params - Optional pagination and ordering parameters
   * @returns Promise containing paginated list of stored scorer definitions
   */
  public listStoredScorers(params?: ListStoredScorersParams): Promise<ListStoredScorersResponse> {
    const searchParams = new URLSearchParams();

    if (params?.page !== undefined) {
      searchParams.set('page', String(params.page));
    }
    if (params?.perPage !== undefined) {
      searchParams.set('perPage', String(params.perPage));
    }
    if (params?.orderBy) {
      if (params.orderBy.field) {
        searchParams.set('orderBy[field]', params.orderBy.field);
      }
      if (params.orderBy.direction) {
        searchParams.set('orderBy[direction]', params.orderBy.direction);
      }
    }
    if (params?.authorId) {
      searchParams.set('authorId', params.authorId);
    }
    if (params?.metadata) {
      searchParams.set('metadata', JSON.stringify(params.metadata));
    }

    const queryString = searchParams.toString();
    return this.request(`/stored/scorers${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Creates a new stored scorer definition
   * @param params - Scorer definition configuration
   * @returns Promise containing the created stored scorer definition
   */
  public createStoredScorer(params: CreateStoredScorerParams): Promise<StoredScorerResponse> {
    return this.request('/stored/scorers', {
      method: 'POST',
      body: params,
    });
  }

  /**
   * Gets a stored scorer definition instance by ID for further operations (details, update, delete)
   * @param storedScorerId - ID of the stored scorer definition
   * @returns StoredScorer instance
   */
  public getStoredScorer(storedScorerId: string): StoredScorer {
    return new StoredScorer(this.options, storedScorerId);
  }

  // ============================================================================
  // Stored MCP Clients
  // ============================================================================

  /**
   * Lists all stored MCP clients with optional pagination
   * @param params - Optional pagination and ordering parameters
   * @returns Promise containing paginated list of stored MCP clients
   */
  public listStoredMCPClients(params?: ListStoredMCPClientsParams): Promise<ListStoredMCPClientsResponse> {
    const searchParams = new URLSearchParams();

    if (params?.page !== undefined) {
      searchParams.set('page', String(params.page));
    }
    if (params?.perPage !== undefined) {
      searchParams.set('perPage', String(params.perPage));
    }
    if (params?.orderBy) {
      if (params.orderBy.field) {
        searchParams.set('orderBy[field]', params.orderBy.field);
      }
      if (params.orderBy.direction) {
        searchParams.set('orderBy[direction]', params.orderBy.direction);
      }
    }
    if (params?.authorId) {
      searchParams.set('authorId', params.authorId);
    }
    if (params?.metadata) {
      searchParams.set('metadata', JSON.stringify(params.metadata));
    }

    const queryString = searchParams.toString();
    return this.request(`/stored/mcp-clients${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Creates a new stored MCP client
   * @param params - MCP client configuration
   * @returns Promise containing the created stored MCP client
   */
  public createStoredMCPClient(params: CreateStoredMCPClientParams): Promise<StoredMCPClientResponse> {
    return this.request('/stored/mcp-clients', {
      method: 'POST',
      body: params,
    });
  }

  /**
   * Gets a stored MCP client instance by ID for further operations (details, update, delete)
   * @param storedMCPClientId - ID of the stored MCP client
   * @returns StoredMCPClient instance
   */
  public getStoredMCPClient(storedMCPClientId: string): StoredMCPClient {
    return new StoredMCPClient(this.options, storedMCPClientId);
  }

  // ============================================================================
  // Stored Skills
  // ============================================================================

  /**
   * Lists all stored skills with optional pagination
   * @param params - Optional pagination and ordering parameters
   * @returns Promise containing paginated list of stored skills
   */
  public listStoredSkills(params?: ListStoredSkillsParams): Promise<ListStoredSkillsResponse> {
    const searchParams = new URLSearchParams();

    if (params?.page !== undefined) {
      searchParams.set('page', String(params.page));
    }
    if (params?.perPage !== undefined) {
      searchParams.set('perPage', String(params.perPage));
    }
    if (params?.orderBy) {
      if (params.orderBy.field) {
        searchParams.set('orderBy[field]', params.orderBy.field);
      }
      if (params.orderBy.direction) {
        searchParams.set('orderBy[direction]', params.orderBy.direction);
      }
    }
    if (params?.authorId) {
      searchParams.set('authorId', params.authorId);
    }
    if (params?.metadata) {
      searchParams.set('metadata', JSON.stringify(params.metadata));
    }

    const queryString = searchParams.toString();
    return this.request(`/stored/skills${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Creates a new stored skill
   * @param params - Skill configuration
   * @returns Promise containing the created stored skill
   */
  public createStoredSkill(params: CreateStoredSkillParams): Promise<StoredSkillResponse> {
    return this.request('/stored/skills', {
      method: 'POST',
      body: params,
    });
  }

  /**
   * Gets a stored skill instance by ID for further operations (details, update, delete)
   * @param storedSkillId - ID of the stored skill
   * @returns StoredSkill instance
   */
  public getStoredSkill(storedSkillId: string): StoredSkill {
    return new StoredSkill(this.options, storedSkillId);
  }

  // ============================================================================
  // Tool Providers
  // ============================================================================

  /**
   * Lists all registered tool providers
   * @returns Promise containing list of tool provider info
   */
  public listToolProviders(): Promise<ListToolProvidersResponse> {
    return this.request('/tool-providers');
  }

  /**
   * Gets a tool provider instance by ID for further operations (listToolkits, listTools, getToolSchema)
   * @param providerId - ID of the tool provider
   * @returns ToolProvider instance
   */
  public getToolProvider(providerId: string): ToolProvider {
    return new ToolProvider(this.options, providerId);
  }

  // ============================================================================
  // Processor Providers
  // ============================================================================

  /**
   * Lists all registered processor providers
   * @returns Promise containing list of processor provider info
   */
  public getProcessorProviders(): Promise<GetProcessorProvidersResponse> {
    return this.request('/processor-providers');
  }

  /**
   * Gets a processor provider instance by ID for further operations
   * @param providerId - ID of the processor provider
   * @returns ProcessorProvider instance
   */
  public getProcessorProvider(providerId: string): ProcessorProvider {
    return new ProcessorProvider(this.options, providerId);
  }

  // ============================================================================
  // System
  // ============================================================================

  /**
   * Retrieves installed Mastra packages and their versions
   * @returns Promise containing the list of installed Mastra packages
   */
  public getSystemPackages(): Promise<GetSystemPackagesResponse> {
    return this.request('/system/packages');
  }

  // ============================================================================
  // Workspace
  // ============================================================================

  /**
   * Lists all workspaces from both Mastra instance and agents
   * @returns Promise containing array of workspace items
   */
  public listWorkspaces(): Promise<ListWorkspacesResponse> {
    return this.request('/workspaces');
  }

  /**
   * Gets the workspace resource for filesystem, search, and skills operations
   * @param workspaceId - Workspace ID to target
   * @returns Workspace instance
   */
  public getWorkspace(workspaceId: string): Workspace {
    return new Workspace(this.options, workspaceId);
  }

  // ============================================================================
  // Vectors & Embedders
  // ============================================================================

  /**
   * Lists all available vector stores
   * @returns Promise containing list of available vector stores
   */
  public listVectors(): Promise<ListVectorsResponse> {
    return this.request('/vectors');
  }

  /**
   * Lists all available embedding models
   * @returns Promise containing list of available embedders
   */
  public listEmbedders(): Promise<ListEmbeddersResponse> {
    return this.request('/embedders');
  }

  // ============================================================================
  // Datasets
  // ============================================================================

  /**
   * Lists all datasets with optional pagination
   */
  public listDatasets(pagination?: {
    page?: number;
    perPage?: number;
  }): Promise<{ datasets: DatasetRecord[]; pagination: PaginationInfo }> {
    const searchParams = new URLSearchParams();
    if (pagination?.page !== undefined) searchParams.set('page', String(pagination.page));
    if (pagination?.perPage !== undefined) searchParams.set('perPage', String(pagination.perPage));
    const qs = searchParams.toString();
    return this.request(`/datasets${qs ? `?${qs}` : ''}`);
  }

  /**
   * Gets a single dataset by ID
   */
  public getDataset(datasetId: string): Promise<DatasetRecord> {
    return this.request(`/datasets/${encodeURIComponent(datasetId)}`);
  }

  /**
   * Creates a new dataset
   */
  public createDataset(params: CreateDatasetParams): Promise<DatasetRecord> {
    return this.request('/datasets', { method: 'POST', body: params });
  }

  /**
   * Updates a dataset
   */
  public updateDataset(params: UpdateDatasetParams): Promise<DatasetRecord> {
    const { datasetId, ...body } = params;
    return this.request(`/datasets/${encodeURIComponent(datasetId)}`, {
      method: 'PATCH',
      body,
    });
  }

  /**
   * Deletes a dataset
   */
  public deleteDataset(datasetId: string): Promise<{ success: boolean }> {
    return this.request(`/datasets/${encodeURIComponent(datasetId)}`, {
      method: 'DELETE',
    });
  }

  // ============================================================================
  // Dataset Items
  // ============================================================================

  /**
   * Lists items in a dataset with optional pagination, search, and version filter
   */
  public listDatasetItems(
    datasetId: string,
    params?: { page?: number; perPage?: number; search?: string; version?: number | null },
  ): Promise<{ items: DatasetItem[]; pagination: PaginationInfo }> {
    const searchParams = new URLSearchParams();
    if (params?.page !== undefined) searchParams.set('page', String(params.page));
    if (params?.perPage !== undefined) searchParams.set('perPage', String(params.perPage));
    if (params?.search) searchParams.set('search', params.search);
    if (params?.version != null) {
      searchParams.set('version', String(params.version));
    }
    const qs = searchParams.toString();
    return this.request(`/datasets/${encodeURIComponent(datasetId)}/items${qs ? `?${qs}` : ''}`);
  }

  /**
   * Gets a single dataset item by ID
   */
  public getDatasetItem(datasetId: string, itemId: string): Promise<DatasetItem> {
    return this.request(`/datasets/${encodeURIComponent(datasetId)}/items/${encodeURIComponent(itemId)}`);
  }

  /**
   * Adds an item to a dataset
   */
  public addDatasetItem(params: AddDatasetItemParams): Promise<DatasetItem> {
    const { datasetId, ...body } = params;
    return this.request(`/datasets/${encodeURIComponent(datasetId)}/items`, {
      method: 'POST',
      body,
    });
  }

  /**
   * Updates a dataset item
   */
  public updateDatasetItem(params: UpdateDatasetItemParams): Promise<DatasetItem> {
    const { datasetId, itemId, ...body } = params;
    return this.request(`/datasets/${encodeURIComponent(datasetId)}/items/${encodeURIComponent(itemId)}`, {
      method: 'PATCH',
      body,
    });
  }

  /**
   * Deletes a dataset item
   */
  public deleteDatasetItem(datasetId: string, itemId: string): Promise<{ success: boolean }> {
    return this.request(`/datasets/${encodeURIComponent(datasetId)}/items/${encodeURIComponent(itemId)}`, {
      method: 'DELETE',
    });
  }

  /**
   * Batch inserts items to a dataset
   */
  public batchInsertDatasetItems(
    params: BatchInsertDatasetItemsParams,
  ): Promise<{ items: DatasetItem[]; count: number }> {
    const { datasetId, ...body } = params;
    return this.request(`/datasets/${encodeURIComponent(datasetId)}/items/batch`, {
      method: 'POST',
      body,
    });
  }

  /**
   * Batch deletes items from a dataset
   */
  public batchDeleteDatasetItems(
    params: BatchDeleteDatasetItemsParams,
  ): Promise<{ success: boolean; deletedCount: number }> {
    const { datasetId, ...body } = params;
    return this.request(`/datasets/${encodeURIComponent(datasetId)}/items/batch`, {
      method: 'DELETE',
      body,
    });
  }

  // ============================================================================
  // Dataset Item Versions
  // ============================================================================

  /**
   * Lists versions for a dataset item
   */
  public getItemHistory(datasetId: string, itemId: string): Promise<{ history: DatasetItemVersionResponse[] }> {
    return this.request(`/datasets/${encodeURIComponent(datasetId)}/items/${encodeURIComponent(itemId)}/history`);
  }

  /**
   * Gets a specific version of a dataset item
   */
  public getDatasetItemVersion(
    datasetId: string,
    itemId: string,
    datasetVersion: number,
  ): Promise<DatasetItemVersionResponse> {
    return this.request(
      `/datasets/${encodeURIComponent(datasetId)}/items/${encodeURIComponent(itemId)}/versions/${datasetVersion}`,
    );
  }

  // ============================================================================
  // Dataset Versions
  // ============================================================================

  /**
   * Lists versions for a dataset
   */
  public listDatasetVersions(
    datasetId: string,
    pagination?: { page?: number; perPage?: number },
  ): Promise<{ versions: DatasetVersionResponse[]; pagination: PaginationInfo }> {
    const searchParams = new URLSearchParams();
    if (pagination?.page !== undefined) searchParams.set('page', String(pagination.page));
    if (pagination?.perPage !== undefined) searchParams.set('perPage', String(pagination.perPage));
    const qs = searchParams.toString();
    return this.request(`/datasets/${encodeURIComponent(datasetId)}/versions${qs ? `?${qs}` : ''}`);
  }

  // ============================================================================
  // Dataset Experiments
  // ============================================================================

  /**
   * Lists experiments for a dataset
   */
  public listDatasetExperiments(
    datasetId: string,
    pagination?: { page?: number; perPage?: number },
  ): Promise<{ experiments: DatasetExperiment[]; pagination: PaginationInfo }> {
    const searchParams = new URLSearchParams();
    if (pagination?.page !== undefined) searchParams.set('page', String(pagination.page));
    if (pagination?.perPage !== undefined) searchParams.set('perPage', String(pagination.perPage));
    const qs = searchParams.toString();
    return this.request(`/datasets/${encodeURIComponent(datasetId)}/experiments${qs ? `?${qs}` : ''}`);
  }

  /**
   * Gets a single dataset experiment by ID
   */
  public getDatasetExperiment(datasetId: string, experimentId: string): Promise<DatasetExperiment> {
    return this.request(`/datasets/${encodeURIComponent(datasetId)}/experiments/${encodeURIComponent(experimentId)}`);
  }

  /**
   * Lists results for a dataset experiment
   */
  public listDatasetExperimentResults(
    datasetId: string,
    experimentId: string,
    pagination?: { page?: number; perPage?: number },
  ): Promise<{ results: DatasetExperimentResult[]; pagination: PaginationInfo }> {
    const searchParams = new URLSearchParams();
    if (pagination?.page !== undefined) searchParams.set('page', String(pagination.page));
    if (pagination?.perPage !== undefined) searchParams.set('perPage', String(pagination.perPage));
    const qs = searchParams.toString();
    return this.request(
      `/datasets/${encodeURIComponent(datasetId)}/experiments/${encodeURIComponent(experimentId)}/results${qs ? `?${qs}` : ''}`,
    );
  }

  /**
   * Triggers a new dataset experiment
   */
  public triggerDatasetExperiment(params: TriggerDatasetExperimentParams): Promise<{
    experimentId: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    totalItems: number;
    succeededCount: number;
    failedCount: number;
    startedAt: string | Date;
    completedAt: string | Date | null;
    results: Array<{
      itemId: string;
      itemDatasetVersion: number | null;
      input: unknown;
      output: unknown | null;
      groundTruth: unknown | null;
      error: string | null;
      startedAt: string | Date;
      completedAt: string | Date;
      retryCount: number;
      scores: Array<{
        scorerId: string;
        scorerName: string;
        score: number | null;
        reason: string | null;
        error: string | null;
      }>;
    }>;
  }> {
    const { datasetId, ...body } = params;
    return this.request(`/datasets/${encodeURIComponent(datasetId)}/experiments`, {
      method: 'POST',
      body,
    });
  }

  /**
   * Compares two dataset experiments for regression detection
   */
  public compareExperiments(params: CompareExperimentsParams): Promise<CompareExperimentsResponse> {
    const { datasetId, ...body } = params;
    return this.request(`/datasets/${encodeURIComponent(datasetId)}/compare`, {
      method: 'POST',
      body,
    });
  }
}
