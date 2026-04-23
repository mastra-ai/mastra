import type {
  AgentCard,
  CancelTaskResponse,
  DeleteTaskPushNotificationConfigParams,
  DeleteTaskPushNotificationConfigResponse,
  GetTaskResponse,
  ListTaskPushNotificationConfigParams,
  ListTaskPushNotificationConfigResponse,
  MessageSendParams,
  SendMessageResponse,
  SendStreamingMessageResponse,
  SetTaskPushNotificationConfigResponse,
  TaskIdParams,
  TaskPushNotificationConfig,
  TaskQueryParams,
} from '@mastra/core/a2a';
import type { ClientOptions } from '../types';
import { BaseResource } from './base';

/**
 * Class for interacting with an agent via the A2A protocol
 */
export class A2A extends BaseResource {
  constructor(
    options: ClientOptions,
    private agentId: string,
  ) {
    super(options);
  }

  /**
   * Get the agent card with metadata about the agent
   * @returns Promise containing the agent card information
   */
  async getCard(): Promise<AgentCard> {
    return this.request(`/.well-known/${this.agentId}/agent-card.json`);
  }

  /**
   * Send a message to the agent and gets a message or task response
   * @param params - Parameters for the task
   * @returns Promise containing the response
   */
  async sendMessage(params: MessageSendParams): Promise<SendMessageResponse> {
    const response = await this.request<SendMessageResponse>(`/a2a/${this.agentId}`, {
      method: 'POST',
      body: {
        jsonrpc: '2.0',
        id: crypto.randomUUID(),
        method: 'message/send',
        params,
      },
    });

    return response;
  }

  /**
   * Sends a message to an agent to initiate/continue a task and subscribes
   * the client to real-time updates for that task via Server-Sent Events (SSE).
   * @param params - Parameters for the task
   * @returns A stream of Server-Sent Events. Each SSE `data` field contains a `SendStreamingMessageResponse`
   */
  async sendStreamingMessage(params: MessageSendParams): Promise<AsyncIterable<SendStreamingMessageResponse>> {
    const response = await this.request<AsyncIterable<SendStreamingMessageResponse>>(`/a2a/${this.agentId}`, {
      method: 'POST',
      body: {
        jsonrpc: '2.0',
        id: crypto.randomUUID(),
        method: 'message/stream',
        params,
      },
      stream: true,
    });

    return response;
  }

  /**
   * Get the status and result of a task
   * @param params - Parameters for querying the task
   * @returns Promise containing the task response
   */
  async getTask(params: TaskQueryParams): Promise<GetTaskResponse> {
    const response = await this.request<GetTaskResponse>(`/a2a/${this.agentId}`, {
      method: 'POST',
      body: {
        jsonrpc: '2.0',
        id: crypto.randomUUID(),
        method: 'tasks/get',
        params,
      },
    });

    return response;
  }

  /**
   * Cancel a running task
   * @param params - Parameters identifying the task to cancel
   * @returns Promise containing the task response
   */
  async cancelTask(params: TaskIdParams): Promise<CancelTaskResponse> {
    return this.request<CancelTaskResponse>(`/a2a/${this.agentId}`, {
      method: 'POST',
      body: {
        jsonrpc: '2.0',
        id: crypto.randomUUID(),
        method: 'tasks/cancel',
        params,
      },
    });
  }

  /**
   * Resume a task stream for an existing task
   * @param params - Parameters identifying the task to resubscribe to
   * @returns A stream of Server-Sent Events for the task
   */
  async resubscribeTask(params: TaskIdParams): Promise<AsyncIterable<SendStreamingMessageResponse>> {
    return this.request<AsyncIterable<SendStreamingMessageResponse>>(`/a2a/${this.agentId}`, {
      method: 'POST',
      body: {
        jsonrpc: '2.0',
        id: crypto.randomUUID(),
        method: 'tasks/resubscribe',
        params,
      },
      stream: true,
    });
  }

  /**
   * Set push notification config for a task
   * @param params - Push notification configuration for the task
   * @returns Promise containing the JSON-RPC response
   */
  async setTaskPushNotificationConfig(
    params: TaskPushNotificationConfig,
  ): Promise<SetTaskPushNotificationConfigResponse> {
    return this.request<SetTaskPushNotificationConfigResponse>(`/a2a/${this.agentId}`, {
      method: 'POST',
      body: {
        jsonrpc: '2.0',
        id: crypto.randomUUID(),
        method: 'tasks/pushNotificationConfig/set',
        params,
      },
    });
  }

  /**
   * List push notification configs for a task
   * @param params - Parameters identifying the task
   * @returns Promise containing the JSON-RPC response
   */
  async listTaskPushNotificationConfig(
    params: ListTaskPushNotificationConfigParams,
  ): Promise<ListTaskPushNotificationConfigResponse> {
    return this.request<ListTaskPushNotificationConfigResponse>(`/a2a/${this.agentId}`, {
      method: 'POST',
      body: {
        jsonrpc: '2.0',
        id: crypto.randomUUID(),
        method: 'tasks/pushNotificationConfig/list',
        params,
      },
    });
  }

  /**
   * Delete a push notification config for a task
   * @param params - Parameters identifying the config to delete
   * @returns Promise containing the JSON-RPC response
   */
  async deleteTaskPushNotificationConfig(
    params: DeleteTaskPushNotificationConfigParams,
  ): Promise<DeleteTaskPushNotificationConfigResponse> {
    return this.request<DeleteTaskPushNotificationConfigResponse>(`/a2a/${this.agentId}`, {
      method: 'POST',
      body: {
        jsonrpc: '2.0',
        id: crypto.randomUUID(),
        method: 'tasks/pushNotificationConfig/delete',
        params,
      },
    });
  }
}
