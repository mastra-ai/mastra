import { MastraClientError } from '@mastra/client-js';
import { ToolError } from '../../../shared/mcp-app';

/**
 * A tool call that fails the way the Studio client does over HTTP: a tool's refusal is a 400 and a tool this app
 * is not offered a 404. The shared list polling reads those statuses to stop on a refused request, as in Studio.
 */
export async function toolRequest<T>(request: Promise<unknown>): Promise<T> {
  try {
    return (await request) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const refused = error instanceof ToolError;
    throw new MastraClientError(refused ? 400 : 404, refused ? 'Bad Request' : 'Not Found', message, {
      error: message,
    });
  }
}
