import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { IMastraLogger } from '@mastra/core/logger';
import type { Server } from '@modelcontextprotocol/server';

/**
 * Sends a notification to every active server instance (the main stdio/SSE
 * instance plus each streamable HTTP session instance).
 *
 * Failures are aggregated: if only some instances fail, the failure is logged
 * and the broadcast is considered best-effort. A `MastraError` is thrown only
 * when every send fails.
 *
 * Note: clients connected in stateless/serverless mode cannot receive
 * notifications because each request uses a transient server instance.
 *
 * @internal
 */
export async function broadcastNotification({
  servers,
  send,
  logger,
  errorId,
  errorText,
  errorDetails,
}: {
  servers: Server[];
  send: (server: Server) => Promise<void>;
  logger: IMastraLogger;
  errorId: Uppercase<string>;
  errorText: string;
  errorDetails?: Record<string, string | number>;
}): Promise<void> {
  const errors: unknown[] = [];
  for (const server of servers) {
    try {
      await send(server);
    } catch (error) {
      errors.push(error);
    }
  }

  if (errors.length === 0) return;

  const mastraError = new MastraError(
    {
      id: errorId,
      domain: ErrorDomain.MCP,
      category: ErrorCategory.THIRD_PARTY,
      text: errorText,
      details: {
        ...errorDetails,
        failedInstances: errors.length,
        totalInstances: servers.length,
      },
    },
    errors[0],
  );
  logger.error(`${errorText}:`, { error: mastraError.toString() });

  if (errors.length === servers.length) {
    logger.trackException(mastraError);
    throw mastraError;
  }
}
