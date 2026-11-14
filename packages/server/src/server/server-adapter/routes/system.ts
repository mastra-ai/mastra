import {
  GET_GATEWAY_AUDIO_MODELS_ROUTE,
  POST_GATEWAY_AUDIO_SPEECH_ROUTE,
  POST_GATEWAY_AUDIO_TRANSCRIPTION_ROUTE,
} from '../../handlers/gateway-audio';
import { GET_API_SCHEMA_ROUTE, GET_SYSTEM_PACKAGES_ROUTE } from '../../handlers/system';

/**
 * System Routes
 *
 * Routes for system information and diagnostics.
 */
export const SYSTEM_ROUTES = [
  GET_SYSTEM_PACKAGES_ROUTE,
  GET_API_SCHEMA_ROUTE,
  GET_GATEWAY_AUDIO_MODELS_ROUTE,
  POST_GATEWAY_AUDIO_SPEECH_ROUTE,
  POST_GATEWAY_AUDIO_TRANSCRIPTION_ROUTE,
] as const;
