import { tools } from '@mastra/connect';
import { createTool } from '@mastra/core/tools';
import type { Tool } from '@mastra/core/tools';
import { z } from 'zod';
import type { AssistantConfig } from './config';

// Only reviewed exact keys belong here. Names and retrieved content never grant permission.
export const reviewedReadTools: ReadonlySet<string> = new Set([
  'google_mail_get_message',
  'notion_get_page_as_markdown',
]);

/** Require native approval for every connected key outside the reviewed read registry. */
export function requiresApproval(key: string) {
  return !reviewedReadTools.has(key);
}

/** Refresh owner-scoped Connect tools and report unavailable providers without exposing credentials. */
export function createConnections(config: AssistantConfig) {
  const configured = config.connect !== undefined;
  const resolver = config.connect
    ? tools({
        projectId: config.connect.projectId,
        providers: config.connect.providers,
        resourceId: config.ownerId,
        connectPrompt: false,
        requireApproval: true,
      })
    : undefined;
  type Status = { state: 'unconfigured' | 'available' | 'unavailable'; unresolvedProviders: string[]; detail: string };
  let status: Status = {
    state: configured ? 'unavailable' : 'unconfigured',
    unresolvedProviders: config.connect?.providers || [],
    detail: configured
      ? 'Connections have not been refreshed.'
      : 'Connect is not configured. Local capabilities remain available.',
  };
  /** Refresh discovery before each run so stale tools cannot silently retain permissions. */
  async function resolve() {
    if (!resolver) return {};
    try {
      // Explicit refresh avoids the resolver's stale-while-revalidate snapshot on a new run or resume.
      const resolved = await resolver.refresh();
      const allowed = config.connect?.toolKeys;
      const selected = Object.entries(resolved).filter(([key]) => !allowed || allowed.includes(key));
      const unresolvedProviders = config.connect!.providers.filter(
        provider => !selected.some(([key]) => key.startsWith(`${provider.replaceAll('-', '_')}_`)),
      );
      status = {
        state: unresolvedProviders.length ? 'unavailable' : 'available',
        unresolvedProviders,
        detail: unresolvedProviders.length
          ? 'Some providers did not resolve usable tools. A missing connection, access problem, or tool restriction is possible; this is not an empty source result.'
          : 'Tools resolved. This confirms tool availability, not successful access to every source record.',
      };
      return Object.fromEntries(
        selected.map(([key, value]) => [
          key,
          createTool({
            ...(value as Tool),
            // A tool-level function is authoritative even when a caller sets requireToolApproval:false.
            requireApproval: () => requiresApproval(key),
          }),
        ]),
      );
    } catch {
      status = {
        state: 'unavailable',
        unresolvedProviders: config.connect!.providers,
        detail:
          'Connect refresh failed. Check the project, credentials and service availability. No source search was completed.',
      };
      return {};
    }
  }
  const connectionStatus = createTool({
    id: 'connection-status',
    description:
      'Refresh connected tool availability and report unresolved providers. An unavailable provider does not mean its source has no records.',
    inputSchema: z.object({}),
    execute: async () => {
      await resolve();
      return status;
    },
  });
  return {
    tools: async () => ({ ...(await resolve()), connection_status: connectionStatus }),
  };
}
