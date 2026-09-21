import { connect, MastraConnectError, type ConnectTools } from '@mastra/connect';

/**
 * One shared Connect resolver for the whole project.
 *
 * `connect()` returns a live toolset over your Mastra platform project's
 * integration connections: every integration attached to the project (Linear,
 * Notion, …) shows up as agent tools, and connections you attach or detach on
 * the platform are picked up without restarting the server.
 *
 * Construction is lazy so the dev server still boots (with a warning) before
 * MASTRA_PLATFORM_ACCESS_TOKEN / MASTRA_PROJECT_ID are configured.
 */
let resolver: ConnectTools | undefined;

function connectResolver(): ConnectTools | undefined {
  if (resolver) return resolver;
  try {
    resolver = connect();
  } catch (error) {
    if (error instanceof MastraConnectError) {
      console.warn(`[connect] Not configured yet: ${error.message}`);
      return undefined;
    }
    throw error;
  }
  return resolver;
}

/**
 * Resolves the current Connect toolset. Returns an empty record when Connect
 * isn't configured or the platform is unreachable, so agents and workflows
 * keep working without integration tools instead of failing outright.
 */
export async function resolveConnectTools(ctx?: { requestContext?: unknown; mastra?: unknown }) {
  const tools = connectResolver();
  if (!tools) return {};
  try {
    return await tools(ctx);
  } catch (error) {
    console.warn(`[connect] Could not resolve tools: ${error instanceof Error ? error.message : String(error)}`);
    return {};
  }
}
