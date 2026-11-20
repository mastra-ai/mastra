import type { App } from '@modelcontextprotocol/ext-apps';
import { callTool } from '../../../shared/mcp-app';
import { toQueryArgs } from '../../../shared/mcp-tools';
import { toolRequest } from './tool-request';

/** Discovery lists stay fresh for as long as Studio's `useEntityNames` and `useEnvironments` keep them. */
export const DISCOVERY_STALE_TIME = 5 * 60 * 1000;

/** One empty list for every discovery query that hasn't loaded, so memoized field lists don't churn. */
export const NO_VALUES: string[] = [];

export type ObservabilityValueKind = 'entityNames' | 'environments';

/** Values seen in observability data, through `list_observability_values`. */
export async function listObservabilityValues(
  app: App,
  kind: ObservabilityValueKind,
  args: Record<string, unknown> = {},
): Promise<string[]> {
  const result = await toolRequest<{ names?: string[]; environments?: string[] } | undefined>(
    callTool(app, 'list_observability_values', toQueryArgs({ kind, ...args })),
  );
  return (kind === 'environments' ? result?.environments : result?.names) ?? [];
}
