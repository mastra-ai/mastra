import { Agent, MemoryThread, Tool, Workflow, Vector, BaseResource } from './resources';
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
  GetTelemetryParams,
  GetTelemetryResponse,
  GetToolResponse,
  GetWorkflowResponse,
  RequestOptions,
  SaveMessageToMemoryParams,
  SaveMessageToMemoryResponse,
} from './types';

export class MastraClient extends BaseResource {
  constructor(options: ClientOptions) {
    super(options);
  }

  /**
   * Retrieves all available agents
   * @returns Promise containing map of agent IDs to agent details
   */
  public getAgents(): Promise<Record<string, GetAgentResponse>> {
    return this.request('/api/agents');
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
   * @param params - Parameters containing the resource ID
   * @returns Promise containing array of memory threads
   */
  public getMemoryThreads(params: GetMemoryThreadParams): Promise<GetMemoryThreadResponse> {
    return this.request(`/api/memory/threads?resourceid=${params.resourceId}&agentId=${params.agentId}`);
  }

  /**
   * Creates a new memory thread
   * @param params - Parameters for creating the memory thread
   * @returns Promise containing the created memory thread
   */
  public createMemoryThread(params: CreateMemoryThreadParams): Promise<CreateMemoryThreadResponse> {
    return this.request(`/api/memory/threads?agentId=${params.agentId}`, { method: 'POST', body: params });
  }

  /**
   * Gets a memory thread instance by ID
   * @param threadId - ID of the memory thread to retrieve
   * @returns MemoryThread instance
   */
  public getMemoryThread(threadId: string, agentId: string) {
    return new MemoryThread(this.options, threadId, agentId);
  }

  /**
   * Saves messages to memory
   * @param params - Parameters containing messages to save
   * @returns Promise containing the saved messages
   */
  public saveMessageToMemory(params: SaveMessageToMemoryParams): Promise<SaveMessageToMemoryResponse> {
    return this.request(`/api/memory/save-messages?agentId=${params.agentId}`, {
      method: 'POST',
      body: params,
    });
  }

  /**
   * Gets the status of the memory system
   * @returns Promise containing memory system status
   */
  public getMemoryStatus(agentId: string): Promise<{ result: boolean }> {
    return this.request(`/api/memory/status?agentId=${agentId}`);
  }

  /**
   * Retrieves all available tools
   * @returns Promise containing map of tool IDs to tool details
   */
  public getTools(): Promise<Record<string, GetToolResponse>> {
    return this.request('/api/tools');
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
   * @returns Promise containing map of workflow IDs to workflow details
   */
  public getWorkflows(): Promise<Record<string, GetWorkflowResponse>> {
    return this.request('/api/workflows');
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
    return this.request(`/api/logs?transportId=${params.transportId}`);
  }

  /**
   * Gets logs for a specific run
   * @param params - Parameters containing run ID to retrieve
   * @returns Promise containing array of log messages
   */
  public getLogForRun(params: GetLogParams): Promise<GetLogsResponse> {
    return this.request(`/api/logs/${params.runId}?transportId=${params.transportId}`);
  }

  /**
   * List of all log transports
   * @returns Promise containing list of log transports
   */
  public getLogTransports(): Promise<{ transports: string[] }> {
    return this.request('/api/logs/transports');
  }

  /**
   * List of all traces (paged)
   * @param params - Parameters for filtering traces
   * @returns Promise containing telemetry data
   */
  public getTelemetry(params?: GetTelemetryParams): Promise<GetTelemetryResponse> {
    const { name, scope, page, perPage, attribute } = params || {};
    const _attribute = attribute ? Object.entries(attribute).map(([key, value]) => `${key}:${value}`) : [];

    const queryObj = {
      ...(name ? { name } : {}),
      ...(scope ? { scope } : {}),
      ...(page ? { page: String(page) } : {}),
      ...(perPage ? { perPage: String(perPage) } : {}),
      ...(_attribute?.length ? { attribute: _attribute } : {}),
    } as const;

    const searchParams = new URLSearchParams();
    if (name) {
      searchParams.set('name', name);
    }
    if (scope) {
      searchParams.set('scope', scope);
    }
    if (page) {
      searchParams.set('page', String(page));
    }
    if (perPage) {
      searchParams.set('perPage', String(perPage));
    }
    if (_attribute) {
      if (Array.isArray(_attribute)) {
        for (const attr of _attribute) {
          searchParams.append('attribute', attr);
        }
      } else {
        searchParams.set('attribute', _attribute);
      }
    }

    if (searchParams.size) {
      return this.request(`/api/telemetry?${searchParams}`);
    } else {
      return this.request(`/api/telemetry`);
    }
  }
}
