import type { TaskSendParams, TaskQueryParams, TaskIdParams, Task, AgentCard, JSONRPCResponse } from '@mastra/core/a2a';
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
    return this.request(`/.well-known/${this.agentId}/agent.json`);
  }

  /**
   * Send a message to the agent and get a response
   * @param params - Parameters for the task
   * @returns Promise containing the task response
   */
  async sendMessage(params: TaskSendParams): Promise<{ task: Task }> {
    const response = await this.request<JSONRPCResponse<Task>>(`/a2a/${this.agentId}`, {
      method: 'POST',
      body: {
        method: 'tasks/send',
        params,
      },
    });

    return { task: response.result! };
  }

  /**
   * Get the status and result of a task
   * @param params - Parameters for querying the task
   * @returns Promise containing the task response
   */
  async getTask(params: TaskQueryParams): Promise<Task> {
    const response = await this.request<JSONRPCResponse<Task>>(`/a2a/${this.agentId}`, {
      method: 'POST',
      body: {
        method: 'tasks/get',
        params,
      },
    });

    return response.result!;
  }

  /**
   * Cancel a running task
   * @param params - Parameters identifying the task to cancel
   * @returns Promise containing the task response
   */
  async cancelTask(params: TaskIdParams): Promise<{ task: Task }> {
    return this.request(`/a2a/${this.agentId}`, {
      method: 'POST',
      body: {
        method: 'tasks/cancel',
        params,
      },
    });
  }

  /**
   * Send a message and subscribe to streaming updates (not fully implemented)
   * @param params - Parameters for the task
   * @returns Promise containing the task response
   */
  async sendAndSubscribe(params: TaskSendParams): Promise<Response> {
    return this.request(`/a2a/${this.agentId}`, {
      method: 'POST',
      body: {
        method: 'tasks/sendSubscribe',
        params,
      },
      stream: true,
    });
  }
}
