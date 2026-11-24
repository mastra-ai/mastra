import { tools as connectTools } from '@mastra/connect';
import type { RequestContext } from '@mastra/core/request-context';

import type { IntegrationTools } from '../../base.js';

// Factory's own source-control tools enforce repository scope and self-review; Connect's would bypass both.
const SOURCE_CONTROL_PROVIDERS = ['github', 'gitlab'];
// Self-hosted GitLab connections get the gitlab_* tools, so only their integration id differs.
const SOURCE_CONTROL_INTEGRATION_IDS = [...SOURCE_CONTROL_PROVIDERS, 'gitlab-self-hosted'];
const SOURCE_CONTROL_TOOL = new RegExp(`^(${SOURCE_CONTROL_PROVIDERS.join('|')})_`);
const DESTRUCTIVE_TOOL = /delete|archive/i;
const RESOLVE_TIMEOUT_MS = 15_000;

export function offersSessionTools(integrationId: string): boolean {
  return !SOURCE_CONTROL_INTEGRATION_IDS.includes(integrationId);
}

/** Why Factory keeps a Connect tool from sessions by default, or `undefined` when sessions get it. */
export type ConnectToolExclusion = 'destructive' | 'source_control';

export function connectToolExclusion(name: string): ConnectToolExclusion | undefined {
  if (SOURCE_CONTROL_TOOL.test(name)) return 'source_control';
  if (DESTRUCTIVE_TOOL.test(name)) return 'destructive';
  return undefined;
}

/** Rejects when `tools` takes longer than a run waits for Connect tools. */
export async function resolveToolsInTime<T>(tools: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`the tools didn't resolve within ${RESOLVE_TIMEOUT_MS / 1000}s`)),
      RESOLVE_TIMEOUT_MS,
    );
  });
  try {
    return await Promise.race([tools, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Every Mastra Connect tool of the project's connections, before Factory's
 * filters. Rejects when the Platform fails or doesn't answer in time.
 */
export function projectConnectTools(
  projectId: string,
): (args: { requestContext: RequestContext }) => Promise<IntegrationTools> {
  const resolve = connectTools({ projectId });
  return ({ requestContext }) => resolveToolsInTime(resolve({ requestContext }));
}

/**
 * The Mastra Connect tools Factory gives sessions by default, without delete,
 * archive, and GitHub/GitLab tools. Passing `tools` replaces that default; call
 * this to keep it alongside your own.
 */
export function platformConnectTools(
  projectId: string,
): (args: { requestContext: RequestContext }) => Promise<IntegrationTools> {
  const resolve = projectConnectTools(projectId);
  return async ({ requestContext }) => {
    try {
      const tools = await resolve({ requestContext });
      return Object.fromEntries(Object.entries(tools).filter(([name]) => !connectToolExclusion(name)));
    } catch (error) {
      console.warn(
        `MastraFactory: Mastra Connect tools are unavailable for this run: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {};
    }
  };
}
