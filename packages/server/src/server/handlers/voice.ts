import {
  GENERATE_SPEECH_DEPRECATED_ROUTE as INTERNAL_GENERATE_SPEECH_DEPRECATED_ROUTE,
  GENERATE_SPEECH_ROUTE as INTERNAL_GENERATE_SPEECH_ROUTE,
  GET_LISTENER_ROUTE as INTERNAL_GET_LISTENER_ROUTE,
  GET_SPEAKERS_DEPRECATED_ROUTE as INTERNAL_GET_SPEAKERS_DEPRECATED_ROUTE,
  GET_SPEAKERS_ROUTE as INTERNAL_GET_SPEAKERS_ROUTE,
  TRANSCRIBE_SPEECH_DEPRECATED_ROUTE as INTERNAL_TRANSCRIBE_SPEECH_DEPRECATED_ROUTE,
  TRANSCRIBE_SPEECH_ROUTE as INTERNAL_TRANSCRIBE_SPEECH_ROUTE,
} from '@internal/voice/routes';
import { agentVersionQuerySchema } from '../schemas/agents';
import type { ServerRoute } from '../server-adapter/routes';

import { getAgentFromSystem, parseVersionSelector } from './agents';
import { handleVersionLabelError } from './version-label-errors';

function withResolvedAgent(mastra: object, agentId: string, agent: unknown): object {
  return new Proxy(mastra, {
    get(target, property, receiver) {
      if (property === 'getAgentById') {
        return (requestedAgentId: string) =>
          requestedAgentId === agentId ? agent : Reflect.get(target, property, target).call(target, requestedAgentId);
      }
      if (property === 'getEditor') return () => undefined;

      const value = Reflect.get(target, property, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

function wrapVersionedVoiceRoute(internalRoute: ServerRoute): ServerRoute {
  return {
    ...internalRoute,
    queryParamSchema: agentVersionQuerySchema,
    handler: async params => {
      const { versionId, label, status, ...internalParams } = params as typeof params & {
        versionId?: string;
        label?: string;
        status?: 'draft' | 'published';
      };
      try {
        const versionOptions = parseVersionSelector({ versionId, label, status }, { source: 'query' });
        const agent = await getAgentFromSystem({
          mastra: params.mastra,
          agentId: String((params as { agentId?: unknown }).agentId ?? ''),
          versionOptions,
          requestContext: params.requestContext,
        });
        const mastra = withResolvedAgent(params.mastra, agent.id, agent);
        return internalRoute.handler({ ...internalParams, mastra } as never);
      } catch (error) {
        return handleVersionLabelError(error, `Error handling ${internalRoute.path}`);
      }
    },
  };
}

export const GET_SPEAKERS_ROUTE = wrapVersionedVoiceRoute(INTERNAL_GET_SPEAKERS_ROUTE as unknown as ServerRoute);
export const GET_SPEAKERS_DEPRECATED_ROUTE = wrapVersionedVoiceRoute(
  INTERNAL_GET_SPEAKERS_DEPRECATED_ROUTE as unknown as ServerRoute,
);
export const GENERATE_SPEECH_ROUTE = wrapVersionedVoiceRoute(INTERNAL_GENERATE_SPEECH_ROUTE as unknown as ServerRoute);
export const GENERATE_SPEECH_DEPRECATED_ROUTE = wrapVersionedVoiceRoute(
  INTERNAL_GENERATE_SPEECH_DEPRECATED_ROUTE as unknown as ServerRoute,
);
export const TRANSCRIBE_SPEECH_ROUTE = wrapVersionedVoiceRoute(
  INTERNAL_TRANSCRIBE_SPEECH_ROUTE as unknown as ServerRoute,
);
export const TRANSCRIBE_SPEECH_DEPRECATED_ROUTE = wrapVersionedVoiceRoute(
  INTERNAL_TRANSCRIBE_SPEECH_DEPRECATED_ROUTE as unknown as ServerRoute,
);
export const GET_LISTENER_ROUTE = wrapVersionedVoiceRoute(INTERNAL_GET_LISTENER_ROUTE as unknown as ServerRoute);
