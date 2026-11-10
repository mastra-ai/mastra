import { tools as connectTools } from '@mastra/connect';
import type { RequestContext } from '@mastra/core/request-context';

import type { IntegrationTools } from '../../base.js';

// Factory's own source-control tools enforce repository scope and self-review; Connect's would bypass both.
const SOURCE_CONTROL_PROVIDERS = ['github', 'gitlab'];
const SOURCE_CONTROL_TOOL = new RegExp(`^(${SOURCE_CONTROL_PROVIDERS.join('|')})_`);
const DESTRUCTIVE_TOOL = /delete|archive/i;
const RESOLVE_TIMEOUT_MS = 15_000;

export function offersSessionTools(integrationId: string): boolean {
  return !SOURCE_CONTROL_PROVIDERS.includes(integrationId);
}

/**
 * The Mastra Connect tools Factory gives sessions by default, without delete,
 * archive, and GitHub/GitLab tools. Passing `tools` replaces that default; call
 * this to keep it alongside your own.
 */
export function platformConnectTools(
  projectId: string,
): (args: { requestContext: RequestContext }) => Promise<IntegrationTools> {
  const resolve = connectTools({ projectId });
  return async ({ requestContext }) => {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`the Platform didn't answer within ${RESOLVE_TIMEOUT_MS / 1000}s`)),
        RESOLVE_TIMEOUT_MS,
      );
    });
    try {
      const tools = await Promise.race([resolve({ requestContext }), timeout]);
      return Object.fromEntries(
        Object.entries(tools).filter(([name]) => !DESTRUCTIVE_TOOL.test(name) && !SOURCE_CONTROL_TOOL.test(name)),
      );
    } catch (error) {
      console.warn(
        `MastraFactory: Mastra Connect tools are unavailable for this run: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {};
    } finally {
      clearTimeout(timer);
    }
  };
}
