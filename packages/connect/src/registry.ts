import type { ToolsInput } from '@mastra/core/agent';

import { createCloudflareTools } from './providers/cloudflare.js';
import { createGitlabTools } from './providers/gitlab.js';
import { createJiraTools } from './providers/jira.js';
import { createLinearTools } from './providers/linear.js';
import { createNeonTools } from './providers/neon.js';
import { createNotionTools } from './providers/notion.js';
import { createSnowflakeTools } from './providers/snowflake.js';
import type { ProviderToolsOptions } from './toolset.js';

export type ProviderKey =
  | 'linear'
  | 'notion'
  | 'jira'
  | 'gitlab'
  | 'snowflake'
  | 'neon'
  | 'cloudflare'
  | 'resend'
  | 'anthropic';

export interface ProviderRegistration {
  /** Platform catalog integration id (differs from the provider key for gitlab → gitlab-group-token). */
  integrationId: string;
  /** Env var consulted when no connectionId option is given. */
  envVar: string;
  createTools: (options?: ProviderToolsOptions) => ToolsInput;
}

/**
 * Providers with shipped toolsets. Later segments add entries; `connect()`
 * warns and skips platform connections whose integrationId is not listed here.
 */
export const PROVIDERS: Partial<Record<ProviderKey, ProviderRegistration>> = {
  linear: {
    integrationId: 'linear',
    envVar: 'MASTRA_LINEAR_CONNECTION_ID',
    createTools: createLinearTools,
  },
  notion: {
    integrationId: 'notion',
    envVar: 'MASTRA_NOTION_CONNECTION_ID',
    createTools: createNotionTools,
  },
  jira: {
    integrationId: 'jira',
    envVar: 'MASTRA_JIRA_CONNECTION_ID',
    createTools: createJiraTools,
  },
  gitlab: {
    integrationId: 'gitlab-group-token',
    envVar: 'MASTRA_GITLAB_CONNECTION_ID',
    createTools: createGitlabTools,
  },
  neon: {
    integrationId: 'neon',
    envVar: 'MASTRA_NEON_CONNECTION_ID',
    createTools: createNeonTools,
  },
  cloudflare: {
    integrationId: 'cloudflare',
    envVar: 'MASTRA_CLOUDFLARE_CONNECTION_ID',
    createTools: createCloudflareTools,
  },
  snowflake: {
    integrationId: 'snowflake',
    envVar: 'MASTRA_SNOWFLAKE_CONNECTION_ID',
    createTools: createSnowflakeTools,
  },
};

export function findProviderByIntegrationId(
  integrationId: string,
): { key: ProviderKey; registration: ProviderRegistration } | undefined {
  for (const [key, registration] of Object.entries(PROVIDERS) as [ProviderKey, ProviderRegistration][]) {
    if (registration.integrationId === integrationId) return { key, registration };
  }
  return undefined;
}
