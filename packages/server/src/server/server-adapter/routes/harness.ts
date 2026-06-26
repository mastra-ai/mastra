import { mirrorAgentControllerRouteAsHarness } from '../../handlers/harness';
import { AGENT_CONTROLLER_ROUTES } from './agent-controller';
import type { ServerRoute } from '.';

/**
 * Legacy `/harness/...` surface, kept for backwards compatibility after the
 * `Harness` → `AgentController` rename. Derived from the canonical
 * {@link AGENT_CONTROLLER_ROUTES} by rewriting each route's path prefix, OpenAPI
 * tag, and permission resource back to the harness flavor. Handlers are shared
 * verbatim, so both surfaces resolve controllers through the same accessor.
 */
export const HARNESS_ROUTES: readonly ServerRoute[] = AGENT_CONTROLLER_ROUTES.map(mirrorAgentControllerRouteAsHarness);
