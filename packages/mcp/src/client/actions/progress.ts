import type { IMastraLogger } from '@mastra/core/logger';
import type { ProgressNotificationSchema } from '@modelcontextprotocol/sdk/types.js';
import type { z } from 'zod';
import type { InternalMastraMCPClient } from '../client';

interface ProgressClientActionsConfig {
    client: InternalMastraMCPClient;
    logger: IMastraLogger;
}

/**
 * Client-side progress actions for handling progress notifications from MCP servers.
 */
export class ProgressClientActions {
    private readonly client: InternalMastraMCPClient;
    private readonly logger: IMastraLogger;

    constructor({ client, logger }: ProgressClientActionsConfig) {
        this.client = client;
        this.logger = logger;
    }

    /**
     * Set a notification handler for progress updates.
     * @param handler The callback function to handle progress notifications.
     */
    public onUpdate(handler: (params: z.infer<typeof ProgressNotificationSchema>['params']) => void): void {
        this.client.setProgressNotificationHandler(handler);
    }
}