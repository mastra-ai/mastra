import * as p from '@clack/prompts';

import { MASTRA_STUDIO_URL } from '../commands/auth/client.js';
import { createBarLogWriter } from './clack-bar.js';
import { selectFailureExcerpt } from './deploy-log-format.js';

export type DeployDashboardKind = 'server' | 'environment';

/** Dashboard page for a deploy, where the complete log can be read. */
export function deployDashboardUrl(
  kind: DeployDashboardKind,
  ids: { orgId: string; projectId: string; deployId: string },
): string {
  const segment = kind === 'server' ? 'server-deploys' : 'deploys';
  return `${MASTRA_STUDIO_URL}/orgs/${ids.orgId}/projects/${ids.projectId}/${segment}/${ids.deployId}`;
}

/**
 * After a deploy fails, show the error rows from the collected log with
 * context, then the failure message and a link to the full log. When every
 * line was already printed (`--debug`), only the message and link are shown.
 */
export function printDeployFailure(options: {
  message: string;
  collectedLogs: string[];
  dashboardUrl: string;
  showAllLogs?: boolean;
}): void {
  if (!options.showAllLogs && options.collectedLogs.length > 0) {
    const excerpt = selectFailureExcerpt(options.collectedLogs);
    if (excerpt.lines.length > 0) {
      p.log.step(excerpt.matched ? 'Errors from the deploy log, with context:' : 'Last lines of the deploy log:');
      createBarLogWriter({ showAll: true }).write(...excerpt.lines);
    }
  }
  p.log.error(options.message);
  p.log.info(`Full log: ${options.dashboardUrl}`);
}
