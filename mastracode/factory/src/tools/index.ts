import type { IntegrationTools } from '../integrations/base.js';
import type { FactoryToolScope } from './scope.js';

export { FACTORY_TOOLS_WITHOUT_APPROVAL, applyFactoryToolPermissions } from './permissions.js';
export { FACTORY_INTERACTIVE_KEY, resolveFactoryToolScope } from './scope.js';
export type { FactoryToolScope } from './scope.js';

/** Storage and services the Factory tools act through. Filled in per tool. */
export type FactoryToolDependencies = Record<string, never>;

export interface CreateFactoryToolsOptions {
  scope: FactoryToolScope;
  deps: FactoryToolDependencies;
}

/**
 * The Factory toolset for a resolved scope. Tools take scope and storage by
 * closure and never read the request context, so a non-session transport
 * (an MCP server) can mount the same set with a scope it resolved itself.
 *
 * Only user sessions get tools. Turns nobody signed in started (notification
 * wakes, webhooks, dispatcher notices) get the read-only set: text from other
 * people reaches those turns, and the management tools act as the session owner.
 */
export function createFactoryTools({ scope }: CreateFactoryToolsOptions): IntegrationTools {
  if (scope.kind !== 'user') return {};
  const readTools: IntegrationTools = {};
  if (!scope.interactive) return readTools;
  return { ...readTools };
}
