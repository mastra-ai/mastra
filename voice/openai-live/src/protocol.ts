/**
 * OpenAI GPT-Live wire-protocol constants.
 *
 * GPT-Live (`/v1/live/sessions`) is a server-driven, full-duplex protocol and is
 * separate from the Realtime API. Names and shapes follow the published
 * references:
 * - https://developers.openai.com/api/reference/resources/live/primary-websocket
 * - https://developers.openai.com/api/docs/guides/live-delegation
 * - https://learn.microsoft.com/en-us/azure/foundry/openai/gpt-live-reference
 *
 * Handshake: the client sends `session.start` (model, instructions, audio and
 * delegation) as the first message and waits for `session.started` before
 * sending audio or commands. After startup `session.update` can only replace
 * `delegation` (one complete object); model, instructions and audio are fixed.
 */

/** Live API server WebSocket endpoint. */
export const LIVE_WS_URL = 'wss://api.openai.com/v1/live/sessions';

/** Default Live model id. */
export const DEFAULT_MODEL = 'gpt-live-1';

/** Default backend Responses model used under `responses` delegation. */
export const DEFAULT_DELEGATION_MODEL = 'gpt-6-luna';

/** Default speaker/voice. */
export const DEFAULT_VOICE = 'marin';

/**
 * Default `User-Agent`. Consumers should override with their own app name.
 */
export const DEFAULT_USER_AGENT = 'mastra-voice-openai-live';

/** Known Live speaker voices. */
export const VOICES = ['marin', 'cedar'];

/** Audio format for input and output: raw mono 24 kHz PCM16 little-endian. */
export const AUDIO_FORMAT = { type: 'audio/pcm', rate: 24000 } as const;

/** Delegation modes. */
export const DELEGATION_MODES = {
  /** A backend Responses model handles reasoning and tool calls. */
  responses: 'responses',
  /** The application handles delegated work and reports back with context appends. */
  client: 'client',
} as const;

/** Client → server events. */
export const CLIENT_EVENTS = {
  /** First message: initial session configuration. */
  sessionStart: 'session.start',
  /** Sparse update; only `delegation` can change after startup. */
  sessionUpdate: 'session.update',
  /** Append caller audio (base64 PCM16). */
  inputAudioAppend: 'session.input_audio.append',
  /** Append trusted instructions. */
  instructionsAppend: 'session.instructions.append',
  /** Append quiet context. */
  thinkingAppend: 'session.thinking.append',
  /** Append content for the model to speak. */
  commentaryAppend: 'session.commentary.append',
  /** Responses delegation: submit a function result. */
  responseItemCreate: 'response.item.create',
  /** Responses delegation: continue the backend response after results are submitted. */
  responseCreate: 'response.create',
  /** Begin graceful shutdown. */
  sessionClose: 'session.close',
} as const;

/** Server → client events. */
export const SERVER_EVENTS = {
  sessionStarted: 'session.started',
  sessionUpdated: 'session.updated',
  /** Base64 output audio in `delta`. There is no output-audio-done event. */
  outputAudioDelta: 'session.output_audio.delta',
  inputTranscriptDelta: 'session.input_transcript.delta',
  outputTranscriptDelta: 'session.output_transcript.delta',
  /** A unit of delegated work (`delegation.id`, `delegation.target`). */
  delegationCreated: 'session.delegation.created',
  /** Envelope for a nested Responses event (`event`), with the outer `delegation_id`. */
  responseEvent: 'response.event',
  sessionClosed: 'session.closed',
  error: 'error',
} as const;

/** Nested Responses event types handled inside a `response.event` envelope. */
export const RESPONSE_EVENTS = {
  outputItemDone: 'response.output_item.done',
  completed: 'response.completed',
} as const;
