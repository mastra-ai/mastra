import type { IMastraLogger } from '@mastra/core/logger';
import type { ElicitRequest, ElicitResult } from '@modelcontextprotocol/sdk/types.js';
import type { InternalMastraMCPClient } from './client';

interface ElicitationClientActionsConfig {
  client: InternalMastraMCPClient;
  logger: IMastraLogger;
}

/**
 * Client-side elicitation actions for handling interactive user input requests.
 *
 * Elicitation allows MCP servers to request structured information from users during
 * tool execution. The client provides a handler that collects user input and returns
 * it to the server.
 */
export class ElicitationClientActions {
  private readonly client: InternalMastraMCPClient;
  private readonly logger: IMastraLogger;

  /**
   * @internal
   */
  constructor({ client, logger }: ElicitationClientActionsConfig) {
    this.client = client;
    this.logger = logger;
  }

  /**
   * Sets a handler function for processing elicitation requests from the server.
   *
   * The handler is called when the server needs to collect user input during tool execution.
   * The handler must return a response with action ('accept', 'decline', or 'cancel') and
   * optional content matching the requested schema.
   *
   * @param handler - Callback function to handle elicitation requests
   *
   * @example
   * ```typescript
   * client.elicitation.onRequest(async (request) => {
   *   console.log('Server message:', request.message);
   *   console.log('Requested schema:', request.requestedSchema);
   *
   *   // Collect user input (e.g., via CLI prompt or UI form)
   *   const userInput = await collectUserInput(request.requestedSchema);
   *
   *   return {
   *     action: 'accept',
   *     content: userInput
   *   };
   * });
   * ```
   *
   * @example
   * ```typescript
   * // Declining an elicitation request
   * client.elicitation.onRequest(async (request) => {
   *   if (!shouldAcceptRequest(request)) {
   *     return { action: 'decline' };
   *   }
   *
   *   const input = await getInput();
   *   return { action: 'accept', content: input };
   * });
   * ```
   */
  public onRequest(handler: (request: ElicitRequest['params']) => Promise<ElicitResult>): void {
    this.client.setElicitationRequestHandler(handler);
  }
}
