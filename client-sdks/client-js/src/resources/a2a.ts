import { MastraA2AError } from '@mastra/core/a2a/client';
import type { AgentCard, JSONRPCResponse, TaskPushNotificationConfig } from '@mastra/core/a2a/client';
import type { ClientOptions } from '../types';
import { MastraClientError as MastraClientErrorClass } from '../types';
import { processA2AStream } from '../utils/process-a2a-stream';
import type { A2AArtifactUpdateEvent, A2AMessage, A2AStatusUpdateEvent, A2ATask } from '../utils/process-a2a-stream';
import { verifyAgentCardSignatureIfPresent } from '../utils/verify-agent-card-signature';
import type {
  AgentCardSignatureKeyProviderInput,
  AgentCardVerificationKey,
  VerifyAgentCardSignatureOptions,
} from '../utils/verify-agent-card-signature';
import { BaseResource } from './base';

/**
 * A2A protocol v1 (`@a2a-js/sdk` 1.x) no longer exports JSON-RPC request-params
 * or response envelope types from its root. This resource speaks HTTP/JSON-RPC
 * directly and works with the wire JSON shapes, so the params and response
 * envelope types it needs are declared locally below.
 */

/** JSON-RPC error object as it appears on the wire. */
export interface A2AJsonRpcError<Data = unknown> {
  code: number;
  message: string;
  data?: Data;
}

/** JSON-RPC response envelope carrying an error (never a result). */
export interface A2AJsonRpcErrorResponse extends JSONRPCResponse {
  error: A2AJsonRpcError;
}

/**
 * Parameters for `SendMessage` / `SendStreamingMessage`. `message` is the v1
 * wire message shape: `{ messageId, role, parts }` (no `kind` discriminator).
 */
export interface MessageSendParams {
  message: A2AMessage;
  configuration?: {
    acceptedOutputModes?: string[];
    historyLength?: number;
    pushNotificationConfig?: TaskPushNotificationConfig;
    blocking?: boolean;
  };
  metadata?: Record<string, unknown>;
}

/** Parameters for querying a task (`GetTask`). */
export interface TaskQueryParams {
  id: string;
  historyLength?: number;
  metadata?: Record<string, unknown>;
}

/** Parameters that only identify a task (`CancelTask` / `SubscribeToTask`). */
export interface TaskIdParams {
  id: string;
  metadata?: Record<string, unknown>;
}

/** Parameters identifying a task and (optionally) a specific push-config. */
export interface GetTaskPushNotificationConfigParams {
  id: string;
  pushNotificationConfigId?: string;
  metadata?: Record<string, unknown>;
}

/** Parameters identifying a task whose push-configs should be listed. */
export interface ListTaskPushNotificationConfigParams {
  id: string;
  metadata?: Record<string, unknown>;
}

/** Parameters identifying a specific push-config to delete. */
export interface DeleteTaskPushNotificationConfigParams {
  id: string;
  pushNotificationConfigId: string;
  metadata?: Record<string, unknown>;
}

export type A2AStreamEventData = A2AMessage | A2ATask | A2AStatusUpdateEvent | A2AArtifactUpdateEvent;
export type SendMessageResult = A2AMessage | A2ATask;
export type { AgentCardSignatureKeyProviderInput, AgentCardVerificationKey, VerifyAgentCardSignatureOptions };

/**
 * A2A protocol version this client speaks. Sent as the `A2A-Version` request
 * header so Mastra servers (which negotiate both v0.3 and v1) interpret the
 * request as v1 and skip legacy wire translation.
 */
const A2A_PROTOCOL_VERSION = '1.0';
const A2A_VERSION_HEADER = 'A2A-Version';
const A2A_VERSION_HEADERS: Record<string, string> = { [A2A_VERSION_HEADER]: A2A_PROTOCOL_VERSION };

/**
 * @experimental Agent Card verification may evolve as A2A JS signing support settles.
 */
export type GetAgentCardOptions = {
  verifySignature?: VerifyAgentCardSignatureOptions;
};

function createA2AJsonRpcError(response: A2AJsonRpcErrorResponse): Error {
  const error = response.error;
  const message = error?.message ?? 'Unknown A2A JSON-RPC error';
  return typeof error?.code === 'number'
    ? new MastraA2AError(error.code, message, error.data)
    : new MastraClientErrorClass(200, 'OK', `A2A JSON-RPC error - ${message}`, error);
}

function unwrapA2AResult<TResult>(response: JSONRPCResponse): TResult {
  if ('error' in response && response.error) {
    throw createA2AJsonRpcError(response as A2AJsonRpcErrorResponse);
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
 * Class for interacting with an agent via the A2A protocol (v1).
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
   * @param options - Optional Agent Card verification settings
   * @returns Promise containing the agent card information
   */
  async getAgentCard(options?: GetAgentCardOptions): Promise<AgentCard> {
    const agentCard = await this.request<AgentCard>(`/.well-known/${this.agentId}/agent-card.json`);

    if (!options?.verifySignature) {
      return agentCard;
    }

    return verifyAgentCardSignatureIfPresent(agentCard, options.verifySignature);
  }

  /**
   * @deprecated Use getAgentCard() instead.
   */
  async getCard(options?: GetAgentCardOptions): Promise<AgentCard> {
    return this.getAgentCard(options);
  }

  /**
   * Get the authenticated extended agent card.
   * @returns Promise containing the authenticated extended agent card
   */
  async getExtendedAgentCard(): Promise<AgentCard> {
    const response = await this.request<JSONRPCResponse>(`/a2a/${this.agentId}`, {
      method: 'POST',
      headers: A2A_VERSION_HEADERS,
      body: {
        jsonrpc: '2.0',
        id: crypto.randomUUID(),
        method: 'GetExtendedAgentCard',
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
  async sendMessage(params: MessageSendParams): Promise<JSONRPCResponse<SendMessageResult>> {
    return this.request<JSONRPCResponse<SendMessageResult>>(`/a2a/${this.agentId}`, {
      method: 'POST',
      headers: A2A_VERSION_HEADERS,
      body: {
        jsonrpc: '2.0',
        id: crypto.randomUUID(),
        method: 'SendMessage',
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
      headers: A2A_VERSION_HEADERS,
      body: {
        jsonrpc: '2.0',
        id: crypto.randomUUID(),
        method: 'SendStreamingMessage',
        params,
      },
      stream: true,
    });

    yield* processA2AStream(await requireResponseBody(response, 'SendStreamingMessage'));
  }

  /**
   * @deprecated Use sendMessageStream() instead.
   */
  async sendStreamingMessage(params: MessageSendParams): Promise<Response> {
    return this.request<Response>(`/a2a/${this.agentId}`, {
      method: 'POST',
      headers: A2A_VERSION_HEADERS,
      body: {
        jsonrpc: '2.0',
        id: crypto.randomUUID(),
        method: 'SendStreamingMessage',
        params,
      },
      stream: true,
    });
  }

  /**
   * Get the status and result of a task.
   * @param params - Parameters for querying the task
   * @returns Promise containing the JSON-RPC response envelope
   */
  async getTask(params: TaskQueryParams): Promise<JSONRPCResponse<A2ATask>> {
    return this.request<JSONRPCResponse<A2ATask>>(`/a2a/${this.agentId}`, {
      method: 'POST',
      headers: A2A_VERSION_HEADERS,
      body: {
        jsonrpc: '2.0',
        id: crypto.randomUUID(),
        method: 'GetTask',
        params,
      },
    });
  }

  /**
   * Cancel a running task.
   * @param params - Parameters identifying the task to cancel
   * @returns Promise containing the task response
   */
  async cancelTask(params: TaskIdParams): Promise<JSONRPCResponse<A2ATask>> {
    return this.request(`/a2a/${this.agentId}`, {
      method: 'POST',
      headers: A2A_VERSION_HEADERS,
      body: {
        jsonrpc: '2.0',
        id: crypto.randomUUID(),
        method: 'CancelTask',
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
      headers: A2A_VERSION_HEADERS,
      body: {
        jsonrpc: '2.0',
        id: crypto.randomUUID(),
        method: 'SubscribeToTask',
        params,
      },
      stream: true,
    });

    yield* processA2AStream(await requireResponseBody(response, 'SubscribeToTask'));
  }

  /**
   * Set push notification config for a task.
   * @param params - Push notification configuration for the task
   * @returns Promise containing the push notification configuration
   */
  async setTaskPushNotificationConfig(params: TaskPushNotificationConfig): Promise<TaskPushNotificationConfig> {
    const response = await this.request<JSONRPCResponse>(`/a2a/${this.agentId}`, {
      method: 'POST',
      headers: A2A_VERSION_HEADERS,
      body: {
        jsonrpc: '2.0',
        id: crypto.randomUUID(),
        method: 'CreateTaskPushNotificationConfig',
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
    const response = await this.request<JSONRPCResponse>(`/a2a/${this.agentId}`, {
      method: 'POST',
      headers: A2A_VERSION_HEADERS,
      body: {
        jsonrpc: '2.0',
        id: crypto.randomUUID(),
        method: 'GetTaskPushNotificationConfig',
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
    const response = await this.request<JSONRPCResponse>(`/a2a/${this.agentId}`, {
      method: 'POST',
      headers: A2A_VERSION_HEADERS,
      body: {
        jsonrpc: '2.0',
        id: crypto.randomUUID(),
        method: 'ListTaskPushNotificationConfigs',
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
    const response = await this.request<JSONRPCResponse>(`/a2a/${this.agentId}`, {
      method: 'POST',
      headers: A2A_VERSION_HEADERS,
      body: {
        jsonrpc: '2.0',
        id: crypto.randomUUID(),
        method: 'DeleteTaskPushNotificationConfig',
        params,
      },
    });

    unwrapA2AResult<unknown>(response);
  }
}
