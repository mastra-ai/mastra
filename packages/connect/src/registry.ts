import type { ToolsInput } from '@mastra/core/agent';

import { PROVIDERS } from './providers/index.js';
import type { ProviderToolsOptions } from './toolset.js';

/**
 * A provider registration. One entry per provider directory generated under
 * `packages/connect/src/providers/<integrationId>/` by the maintainer-only
 * `pnpm --filter @mastra/connect add-provider` command.
 *
 * `integrationId` is the Platform catalog id, the directory name, and the
 * toolset key returned by `connect()`. Provider matching against project
 * connections is by `integrationId` only.
 *
 * `envVar` is the fallback connection-id env var read at execute time when
 * no `connectionId` override is given and more than one active connection
 * exists on the project for this provider.
 */
export interface ProviderRegistration {
  integrationId: string;
  envVar: string;
  createTools: (options?: ProviderToolsOptions) => ToolsInput;
}

/**
 * Providers with shipped toolsets. The list is assembled declaratively in the
 * generated `src/providers/index.ts` barrel — each generated provider module
 * exports a `ProviderRegistration` const, and the barrel collects them.
 * `connect()` reads this list and exposes one toolset per matching Platform
 * connection on the project. Providers with no matching connection yet are
 * kept and warned about once, so tools appear automatically once a connection
 * is attached.
 */
export { PROVIDERS };

export function findRegistration(integrationId: string): ProviderRegistration | undefined {
  return PROVIDERS.find(p => p.integrationId === integrationId);
}
