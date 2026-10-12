import {
  GENERATE_SPEECH_DEPRECATED_ROUTE as INTERNAL_GENERATE_SPEECH_DEPRECATED_ROUTE,
  GENERATE_SPEECH_ROUTE as INTERNAL_GENERATE_SPEECH_ROUTE,
  GET_LISTENER_ROUTE as INTERNAL_GET_LISTENER_ROUTE,
  GET_SPEAKERS_DEPRECATED_ROUTE as INTERNAL_GET_SPEAKERS_DEPRECATED_ROUTE,
  GET_SPEAKERS_ROUTE as INTERNAL_GET_SPEAKERS_ROUTE,
  TRANSCRIBE_SPEECH_DEPRECATED_ROUTE as INTERNAL_TRANSCRIBE_SPEECH_DEPRECATED_ROUTE,
  TRANSCRIBE_SPEECH_ROUTE as INTERNAL_TRANSCRIBE_SPEECH_ROUTE,
} from '@internal/voice/routes';
import { isMastraErrorCode } from '../http-errors';
import { HTTPException } from '../http-exception';
import type { StatusCode } from '../http-exception';
import type { ServerRoute } from '../server-adapter/routes';

// @internal/voice cannot depend on @mastra/server, so it throws its own
// HTTPException mirror. Convert it here so only a real HTTPException carries a public code.
function toServerException(error: unknown): unknown {
  if (error instanceof HTTPException || !(error instanceof Error)) return error;
  const { status, code } = error as { status?: unknown; code?: unknown };
  if (typeof status !== 'number' || !isMastraErrorCode(code)) return error;
  return new HTTPException(status as StatusCode, {
    message: error.message,
    cause: error.cause,
    stack: error.stack,
    code,
  });
}

function toServerRoute(internalRoute: unknown): ServerRoute {
  const route = internalRoute as ServerRoute;
  return {
    ...route,
    handler: async params => {
      try {
        return await route.handler(params);
      } catch (error) {
        throw toServerException(error);
      }
    },
  };
}

export const GET_SPEAKERS_ROUTE = toServerRoute(INTERNAL_GET_SPEAKERS_ROUTE);
export const GET_SPEAKERS_DEPRECATED_ROUTE = toServerRoute(INTERNAL_GET_SPEAKERS_DEPRECATED_ROUTE);
export const GENERATE_SPEECH_ROUTE = toServerRoute(INTERNAL_GENERATE_SPEECH_ROUTE);
export const GENERATE_SPEECH_DEPRECATED_ROUTE = toServerRoute(INTERNAL_GENERATE_SPEECH_DEPRECATED_ROUTE);
export const TRANSCRIBE_SPEECH_ROUTE = toServerRoute(INTERNAL_TRANSCRIBE_SPEECH_ROUTE);
export const TRANSCRIBE_SPEECH_DEPRECATED_ROUTE = toServerRoute(INTERNAL_TRANSCRIBE_SPEECH_DEPRECATED_ROUTE);
export const GET_LISTENER_ROUTE = toServerRoute(INTERNAL_GET_LISTENER_ROUTE);
