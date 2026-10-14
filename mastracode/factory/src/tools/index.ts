import type { IntegrationTools } from '../integrations/base.js';
import { createFactoryMessagingTools } from './messaging-tools.js';
import type { FactoryMessagingToolDependencies } from './messaging-tools.js';
import { createFactoryReadTools } from './read-tools.js';
import type { FactoryReadToolDependencies } from './read-tools.js';
import type { FactoryToolScope } from './scope.js';
import { createFactoryWorkItemTools } from './work-item-tools.js';
import type { FactoryWorkItemToolDependencies } from './work-item-tools.js';

export { FACTORY_TOOLS_WITHOUT_APPROVAL, applyFactoryToolPermissions } from './permissions.js';
export { FACTORY_INTERACTIVE_KEY, resolveFactoryToolScope } from './scope.js';
export type { FactoryToolScope } from './scope.js';

/** Storage and services the Factory tools act through. */
export type FactoryToolDependencies = FactoryReadToolDependencies &
  FactoryWorkItemToolDependencies &
  FactoryMessagingToolDependencies;

export interface CreateFactoryToolsOptions {
  scope: FactoryToolScope;
  deps: FactoryToolDependencies;
}

/**
 * The Factory toolset for a resolved scope. Tools take scope and storage by
 * closure and never read the request context, so a non-session transport
 * (an MCP server) can mount the same set with a scope it resolved itself.
 *
 * Worker sessions only answer messages. User sessions get everything; turns
 * nobody signed in started (notification wakes, webhooks, dispatcher notices)
 * get the read tools and messaging limited to sessions they follow: text from
 * other people reaches those turns, and the management tools act as the
 * session owner.
 */
export function createFactoryTools({ scope, deps }: CreateFactoryToolsOptions): IntegrationTools {
  const messagingTools = createFactoryMessagingTools(scope, deps);
  if (scope.kind !== 'user') return messagingTools;
  const readTools = { ...createFactoryReadTools(scope, deps), ...messagingTools };
  if (!scope.interactive) return readTools;
  return { ...readTools, ...createFactoryWorkItemTools(scope, deps) };
}
