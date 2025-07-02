import type { AbstractAgent } from '@ag-ui/client';
import type { ServerDetailInfo } from '@mastra/core/mcp';
import { AGUIAdapter } from './adapters/agui';
import {
  Agent,
  MemoryThread,
  Tool,
  Workflow,
  Vector,
  BaseResource,
  Network,
  A2A,
  MCPTool,
  LegacyWorkflow,
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
  GetNetworkResponse,
  GetTelemetryParams,
  GetTelemetryResponse,
  GetToolResponse,
  GetWorkflowResponse,
  SaveMessageToMemoryParams,
  SaveMessageToMemoryResponse,
  McpServerListResponse,
  McpServerToolListResponse,
  GetLegacyWorkflowResponse,
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

  public async getAGUI({ resourceId }: { resourceId: string }): Promise<Record<string, AbstractAgent>> {
    const agents = await this.getAgents();

    return Object.entries(agents).reduce(
      (acc, [agentId]) => {
        const agent = this.getAgent(agentId);

        acc[agentId] = new AGUIAdapter({
          agentId,
          agent,
          resourceId,
        });

        return acc;
      },
      {} as Record<string, AbstractAgent>,
    );
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
   * Retrieves all available legacy workflows
   * @returns Promise containing map of legacy workflow IDs to legacy workflow details
   */
  public getLegacyWorkflows(): Promise<Record<string, GetLegacyWorkflowResponse>> {
    return this.request('/api/workflows/legacy');
  }

  /**
   * Gets a legacy workflow instance by ID
   * @param workflowId - ID of the legacy workflow to retrieve
   * @returns Legacy Workflow instance
   */
  public getLegacyWorkflow(workflowId: string) {
    return new LegacyWorkflow(this.options, workflowId);
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
   * List of all traces (paged)
   * @param params - Parameters for filtering traces
   * @returns Promise containing telemetry data
   */
  public getTelemetry(params?: GetTelemetryParams): Promise<GetTelemetryResponse> {
    const { name, scope, page, perPage, attribute, fromDate, toDate } = params || {};
    const _attribute = attribute ? Object.entries(attribute).map(([key, value]) => `${key}:${value}`) : [];

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
    if (fromDate) {
      searchParams.set('fromDate', fromDate.toISOString());
    }
    if (toDate) {
      searchParams.set('toDate', toDate.toISOString());
    }

    if (searchParams.size) {
      return this.request(`/api/telemetry?${searchParams}`);
    } else {
      return this.request(`/api/telemetry`);
    }
  }

  /**
   * Retrieves all available networks
   * @returns Promise containing map of network IDs to network details
   */
  public getNetworks(): Promise<Record<string, GetNetworkResponse>> {
    return this.request('/api/networks');
  }

  /**
   * Gets a network instance by ID
   * @param networkId - ID of the network to retrieve
   * @returns Network instance
   */
  public getNetwork(networkId: string) {
    return new Network(this.options, networkId);
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
}
