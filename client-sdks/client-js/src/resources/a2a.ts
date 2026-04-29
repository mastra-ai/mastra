import { MastraA2AError } from '@mastra/core/a2a';
import type {
  AgentCard,
  DeleteTaskPushNotificationConfigParams,
  DeleteTaskPushNotificationConfigResponse,
  GetAuthenticatedExtendedCardResponse,
  GetTaskPushNotificationConfigParams,
  GetTaskPushNotificationConfigResponse,
  GetTaskResponse,
  JSONRPCErrorResponse,
  JSONRPCResponse,
  ListTaskPushNotificationConfigParams,
  ListTaskPushNotificationConfigResponse,
  Message,
  MessageSendParams,
  SendMessageResponse,
  SetTaskPushNotificationConfigResponse,
  Task,
  TaskArtifactUpdateEvent,
  TaskIdParams,
  TaskPushNotificationConfig,
  TaskQueryParams,
  TaskStatusUpdateEvent,
} from '@mastra/core/a2a';
import type { ClientOptions } from '../types';
import { MastraClientError as MastraClientErrorClass } from '../types';
import { processA2AStream } from '../utils/process-a2a-stream';
import { BaseResource } from './base';

export type A2AStreamEventData = Message | Task | TaskStatusUpdateEvent | TaskArtifactUpdateEvent;
export type SendMessageResult = Message | Task;

function createA2AJsonRpcError(response: JSONRPCErrorResponse): Error {
  const error = response.error;
  const message = error?.message ?? 'Unknown A2A JSON-RPC error';
  return typeof error?.code === 'number'
    ? new MastraA2AError(error.code, message, error.data)
    : new MastraClientErrorClass(200, 'OK', `A2A JSON-RPC error - ${message}`, error);
}

function unwrapA2AResult<TResult>(response: JSONRPCResponse): TResult {
  if ('error' in response && response.error) {
    throw createA2AJsonRpcError(response as JSONRPCErrorResponse);
  }

  if ('result' in response) {
    return response.result as TResult;
  }

  throw new MastraClientErrorClass(200, 'OK', 'A2A JSON-RPC response did not include a result', response);
}

async function requireResponseBody(response: Response, method: string): Promise<ReadableStream<Uint8Array>> {
  if (response.body) {
    return response.body;
  }

  const headerSummary = Array.from(response.headers.entries())
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ');

  let responseText = '';
  try {
    responseText = await response.text();
  } catch {
    // Ignore body read failures and surface the rest of the response context.
  }

  const details = [
    `A2A ${method} stream response did not include a body`,
    `(status: ${response.status} ${response.statusText})`,
    headerSummary ? `headers: ${headerSummary}` : '',
    responseText ? `body: ${responseText}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  throw new MastraClientErrorClass(response.status, response.statusText, details);
}

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
   * Get the agent card with metadata about the agent.
   * @returns Promise containing the agent card information
   */
  async getAgentCard(): Promise<AgentCard> {
    return this.request(`/.well-known/${this.agentId}/agent-card.json`);
  }

  /**
   * @deprecated Use getAgentCard() instead.
   */
  async getCard(): Promise<AgentCard> {
    return this.getAgentCard();
  }

  /**
   * Get the authenticated extended agent card.
   * @returns Promise containing the authenticated extended agent card
   */
  async getExtendedAgentCard(): Promise<AgentCard> {
    const response = await this.request<GetAuthenticatedExtendedCardResponse>(`/a2a/${this.agentId}`, {
      method: 'POST',
      body: {
        jsonrpc: '2.0',
        id: crypto.randomUUID(),
        method: 'agent/getAuthenticatedExtendedCard',
      },
    });

    return unwrapA2AResult<AgentCard>(response);
  }

  /**
   * @deprecated Use sendMessageStream() for the streaming experience.
   * Send a message to the agent and gets a message or task response.
   * @param params - Parameters for the task
   * @returns Promise containing the JSON-RPC response envelope
   */
  async sendMessage(params: MessageSendParams): Promise<SendMessageResponse> {
    return this.request<SendMessageResponse>(`/a2a/${this.agentId}`, {
      method: 'POST',
      body: {
        jsonrpc: '2.0',
        id: crypto.randomUUID(),
        method: 'message/send',
        params,
      },
    });
  }

  /**
   * Sends a message to an agent to initiate or continue a task and subscribes
   * the client to real-time updates for that task via Server-Sent Events (SSE).
   * @param params - Parameters for the task
   * @returns An async generator of typed A2A stream events
   */
  async *sendMessageStream(params: MessageSendParams): AsyncGenerator<A2AStreamEventData, void, undefined> {
    const response = await this.request<Response>(`/a2a/${this.agentId}`, {
      method: 'POST',
      body: {
        jsonrpc: '2.0',
        id: crypto.randomUUID(),
        method: 'message/stream',
        params,
      },
      stream: true,
    });

    yield* processA2AStream(await requireResponseBody(response, 'message/stream'));
  }

  /**
   * @deprecated Use sendMessageStream() instead.
   */
  async sendStreamingMessage(params: MessageSendParams): Promise<Response> {
    return this.request<Response>(`/a2a/${this.agentId}`, {
      method: 'POST',
      body: {
        jsonrpc: '2.0',
        id: crypto.randomUUID(),
        method: 'message/stream',
        params,
      },
      stream: true,
    });
  }

  /**
   * @deprecated
   * Get the status and result of a task.
   * @param params - Parameters for querying the task
   * @returns Promise containing the JSON-RPC response envelope
   */
  async getTask(params: TaskQueryParams): Promise<GetTaskResponse> {
    return this.request<GetTaskResponse>(`/a2a/${this.agentId}`, {
      method: 'POST',
      body: {
        jsonrpc: '2.0',
        id: crypto.randomUUID(),
        method: 'tasks/get',
        params,
      },
    });
  }

  /**
   * @deprecated
   * Cancel a running task.
   * @param params - Parameters identifying the task to cancel
   * @returns Promise containing the task response
   */
  async cancelTask(params: TaskQueryParams): Promise<Task> {
    return this.request(`/a2a/${this.agentId}`, {
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
   * Resume a task stream for an existing task.
   * @param params - Parameters identifying the task to resubscribe to
   * @returns An async generator of typed A2A stream events
   */
  async *resubscribeTask(params: TaskIdParams): AsyncGenerator<A2AStreamEventData, void, undefined> {
    const response = await this.request<Response>(`/a2a/${this.agentId}`, {
      method: 'POST',
      body: {
        jsonrpc: '2.0',
        id: crypto.randomUUID(),
        method: 'tasks/resubscribe',
        params,
      },
      stream: true,
    });

    yield* processA2AStream(await requireResponseBody(response, 'tasks/resubscribe'));
  }

  /**
   * Set push notification config for a task.
   * @param params - Push notification configuration for the task
   * @returns Promise containing the push notification configuration
   */
  async setTaskPushNotificationConfig(params: TaskPushNotificationConfig): Promise<TaskPushNotificationConfig> {
    const response = await this.request<SetTaskPushNotificationConfigResponse>(`/a2a/${this.agentId}`, {
      method: 'POST',
      body: {
        jsonrpc: '2.0',
        id: crypto.randomUUID(),
        method: 'tasks/pushNotificationConfig/set',
        params,
      },
    });

    return unwrapA2AResult<TaskPushNotificationConfig>(response);
  }

  /**
   * Get push notification config for a task.
   * @param params - Parameters identifying the task
   * @returns Promise containing the push notification configuration
   */
  async getTaskPushNotificationConfig(
    params: GetTaskPushNotificationConfigParams,
  ): Promise<TaskPushNotificationConfig> {
    const response = await this.request<GetTaskPushNotificationConfigResponse>(`/a2a/${this.agentId}`, {
      method: 'POST',
      body: {
        jsonrpc: '2.0',
        id: crypto.randomUUID(),
        method: 'tasks/pushNotificationConfig/get',
        params,
      },
    });

    return unwrapA2AResult<TaskPushNotificationConfig>(response);
  }

  /**
   * List push notification configs for a task.
   * @param params - Parameters identifying the task
   * @returns Promise containing the push notification configurations
   */
  async listTaskPushNotificationConfig(
    params: ListTaskPushNotificationConfigParams,
  ): Promise<TaskPushNotificationConfig[]> {
    const response = await this.request<ListTaskPushNotificationConfigResponse>(`/a2a/${this.agentId}`, {
      method: 'POST',
      body: {
        jsonrpc: '2.0',
        id: crypto.randomUUID(),
        method: 'tasks/pushNotificationConfig/list',
        params,
      },
    });

    return unwrapA2AResult<TaskPushNotificationConfig[]>(response);
  }

  /**
   * Delete a push notification config for a task.
   * @param params - Parameters identifying the config to delete
   * @returns Promise that resolves when the config is deleted
   */
  async deleteTaskPushNotificationConfig(params: DeleteTaskPushNotificationConfigParams): Promise<void> {
    const response = await this.request<DeleteTaskPushNotificationConfigResponse>(`/a2a/${this.agentId}`, {
      method: 'POST',
      body: {
        jsonrpc: '2.0',
        id: crypto.randomUUID(),
        method: 'tasks/pushNotificationConfig/delete',
        params,
      },
    });

    unwrapA2AResult<unknown>(response);
  }
}
