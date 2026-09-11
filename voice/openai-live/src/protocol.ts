/**
 * OpenAI Live API wire-protocol constants.
 *
 * OpenAI's Live API (`gpt-live-1`, base path `/v1/live`) is a distinct,
 * **server-driven** full-duplex protocol — NOT the Realtime API contract. The
 * model decides when turns start and end; there is no `response.create`,
 * `response.cancel`, or `turn_detection`. Reasoning and tool use are delegated
 * to a backend (`responses` mode) or handled by the client (`client` mode).
 *
 * Confirmed from OpenAI's "Getting started with GPT-Live" guide and shipped
 * integrations (jambonz, LiveKit GPT-Live plugin):
 * - Endpoint `/v1/live/sessions`; WebSocket transport for server-side audio.
 * - Exactly SIX client → server events (see CLIENT_EVENTS below).
 * - Server → client: `session.started` (ready) and `delegation.created`
 *   (model needs a tool/backend result, answered with
 *   `delegation.function_call_output.create`; the server resumes on its own —
 *   no follow-on response event to send).
 * - `session.update` must be sent first; the model won't accept caller audio
 *   until it has the config. Tools live under `responses.tools` and the nested
 *   `responses` object (with its own backend `model`) is required in `responses`
 *   delegation mode.
 *
 * NOT YET publicly documented: the exact names of the server → client audio and
 * transcript output events. Those handlers below are best-effort and marked
 * `TODO(verify)`; they are isolated here so they can be corrected in one place
 * once OpenAI publishes the Live server-events reference.
 */

/** Live API server WebSocket endpoint. */
export const LIVE_WS_URL = 'wss://api.openai.com/v1/live/sessions';

/** Default Live model id. */
export const DEFAULT_MODEL = 'gpt-live-1';

/** Default backend Responses model used under `responses` delegation. */
export const DEFAULT_DELEGATION_MODEL = 'gpt-5.5';

/** Default speaker/voice. */
export const DEFAULT_VOICE = 'marin';

/**
 * Default `User-Agent`. Consumers should override with their own app name.
 */
export const DEFAULT_USER_AGENT = 'mastra-voice-openai-live';

/** Known Live speaker voices. Best-effort until OpenAI publishes a stable list. */
export const VOICES = ['marin', 'cedar'];

/** Delegation modes. */
export const DELEGATION_MODES = {
  /** Backend Responses model handles reasoning and tool selection. */
  responses: 'responses',
  /** The client handles reasoning; no backend tool channel. */
  client: 'client',
} as const;

/**
 * The six client → server events GPT-Live accepts. There is intentionally no
 * `response.create`: GPT-Live is server-driven and resumes turns on its own.
 */
export const CLIENT_EVENTS = {
  /** Configure the session. Required first; must precede caller audio. */
  sessionUpdate: 'session.update',
  /** Append caller input audio (base64). */
  inputAudioAppend: 'input_audio.append',
  /** Append text/context to the spoken conversation. */
  sessionContextAppend: 'session.context.append',
  /** Append context to the delegation backend. */
  delegationContextAppend: 'delegation.context.append',
  /** Return a tool/function result for an open delegation. */
  delegationFunctionCallOutputCreate: 'delegation.function_call_output.create',
  /** Close the session. */
  sessionClose: 'session.close',
} as const;

/** Server → client events. */
export const SERVER_EVENTS = {
  /** The session has started and is ready for audio. */
  sessionStarted: 'session.started',
  /** The session config was updated. */
  sessionUpdated: 'session.updated',
  /** The model needs a delegated result; answer with delegationFunctionCallOutputCreate. */
  delegationCreated: 'delegation.created',
  /** An error occurred. */
  error: 'error',

  // TODO(verify): exact server audio/transcript output event names are not yet
  // publicly documented for the Live API. Best-effort placeholders below.
  /** A chunk of assistant output audio (base64). */
  outputAudioDelta: 'output_audio.delta',
  /** Assistant output audio finished. */
  outputAudioDone: 'output_audio.done',
  /** A chunk of assistant transcript text. */
  outputTranscriptDelta: 'output_audio_transcript.delta',
  /** Assistant transcript finished. */
  outputTranscriptDone: 'output_audio_transcript.done',
} as const;

/** Payload field names used across Live events. */
export const LIVE_FIELDS = {
  /** Base64 audio payload on input/output audio events. */
  audio: 'audio',
  /** Assistant transcript delta text. */
  delta: 'delta',
  /** Tool/function name on a delegation. */
  name: 'name',
  /** JSON-encoded arguments on a delegation. */
  arguments: 'arguments',
  /** Correlation id for a delegation to answer against. */
  delegationId: 'delegation_id',
} as const;
