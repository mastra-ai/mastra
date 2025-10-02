import type { IMastraLogger } from '@mastra/core/logger';
import type { ElicitRequest, ElicitResult } from '@modelcontextprotocol/sdk/types.js';
import type { InternalMastraMCPClient } from './client';

interface ElicitationClientActionsConfig {
  client: InternalMastraMCPClient;
  logger: IMastraLogger;
}

export class ElicitationClientActions {
  private readonly client: InternalMastraMCPClient;
  private readonly logger: IMastraLogger;

  constructor({ client, logger }: ElicitationClientActionsConfig) {
    this.client = client;
    this.logger = logger;
  }

  /**
   * Set a handler for elicitation requests.
   * @param handler The callback function to handle the elicitation request.
   */
  public onRequest(handler: (request: ElicitRequest['params']) => Promise<ElicitResult>): void {
    this.client.setElicitationRequestHandler(handler);
  }
}
