import {
  GENERATE_SPEECH_DEPRECATED_ROUTE as INTERNAL_GENERATE_SPEECH_DEPRECATED_ROUTE,
  GENERATE_SPEECH_ROUTE as INTERNAL_GENERATE_SPEECH_ROUTE,
  GET_LISTENER_ROUTE as INTERNAL_GET_LISTENER_ROUTE,
  GET_SPEAKERS_DEPRECATED_ROUTE as INTERNAL_GET_SPEAKERS_DEPRECATED_ROUTE,
  GET_SPEAKERS_ROUTE as INTERNAL_GET_SPEAKERS_ROUTE,
  TRANSCRIBE_SPEECH_DEPRECATED_ROUTE as INTERNAL_TRANSCRIBE_SPEECH_DEPRECATED_ROUTE,
  TRANSCRIBE_SPEECH_ROUTE as INTERNAL_TRANSCRIBE_SPEECH_ROUTE,
} from '@internal/voice/routes';
import type { ServerRoute } from '../server-adapter/routes';
import { getAgentFromSystem } from './agents';

/**
 * The voice routes resolve agents (including stored agents) inside `@internal/voice`, which can't apply the server's
 * stored-agent visibility rules. Resolve through `getAgentFromSystem` first so a caller without access gets a 404.
 */
function withAgentAccess(route: unknown, access: 'read' | 'execute'): ServerRoute {
  const serverRoute = route as ServerRoute<{ agentId: string }>;
  return {
    ...serverRoute,
    handler: async (params: Parameters<typeof serverRoute.handler>[0]) => {
      await getAgentFromSystem({
        mastra: params.mastra,
        agentId: params.agentId,
        requestContext: params.requestContext,
        access,
      });
      return serverRoute.handler(params);
    },
  } as ServerRoute;
}

export const GET_SPEAKERS_ROUTE = withAgentAccess(INTERNAL_GET_SPEAKERS_ROUTE, 'read');
export const GET_SPEAKERS_DEPRECATED_ROUTE = withAgentAccess(INTERNAL_GET_SPEAKERS_DEPRECATED_ROUTE, 'read');
export const GENERATE_SPEECH_ROUTE = withAgentAccess(INTERNAL_GENERATE_SPEECH_ROUTE, 'execute');
export const GENERATE_SPEECH_DEPRECATED_ROUTE = withAgentAccess(INTERNAL_GENERATE_SPEECH_DEPRECATED_ROUTE, 'execute');
export const TRANSCRIBE_SPEECH_ROUTE = withAgentAccess(INTERNAL_TRANSCRIBE_SPEECH_ROUTE, 'execute');
export const TRANSCRIBE_SPEECH_DEPRECATED_ROUTE = withAgentAccess(
  INTERNAL_TRANSCRIBE_SPEECH_DEPRECATED_ROUTE,
  'execute',
);
export const GET_LISTENER_ROUTE = withAgentAccess(INTERNAL_GET_LISTENER_ROUTE, 'read');
