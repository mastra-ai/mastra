/**
 * Hand-rolled event types for Inworld's Realtime API.
 *
 * Inworld's wire protocol is the OpenAI Realtime GA spec — the event names
 * below match what OpenAI's GA reference also publishes (e.g.
 * `conversation.item.added`, `conversation.item.done`). Earlier Beta docs
 * used `conversation.item.created`; GA is what's reflected here.
 *
 * Type names mirror the wire event types verbatim so handlers and switch
 * statements line up with what the server sends.
 */

export type InworldClientEventType =
  | 'session.update'
  | 'conversation.item.create'
  | 'conversation.item.delete'
  | 'conversation.item.retrieve'
  | 'conversation.item.truncate'
  | 'response.create'
  | 'response.cancel'
  | 'input_audio_buffer.append'
  | 'input_audio_buffer.commit'
  | 'input_audio_buffer.clear'
  | 'output_audio_buffer.clear';

export type InworldServerEventType =
  | 'session.created'
  | 'session.updated'
  | 'conversation.item.added'
  | 'conversation.item.done'
  | 'conversation.item.deleted'
  | 'response.created'
  | 'response.output_item.added'
  | 'response.output_item.done'
  | 'response.content_part.added'
  | 'response.content_part.done'
  | 'response.output_audio.delta'
  | 'response.output_audio.done'
  | 'response.output_audio_transcript.delta'
  | 'response.output_audio_transcript.done'
  | 'response.output_text.delta'
  | 'response.output_text.done'
  | 'response.function_call_arguments.delta'
  | 'response.function_call_arguments.done'
  | 'response.done'
  | 'input_audio_buffer.speech_started'
  | 'input_audio_buffer.speech_stopped'
  | 'input_audio_buffer.committed'
  | 'input_audio_buffer.cleared'
  | 'error';

export interface InworldTool {
  type: 'function';
  name: string;
  description?: string;
  parameters: Record<string, unknown>;
}

export type InworldToolChoice =
  | 'auto'
  | 'none'
  | 'required'
  | { type: 'function'; name: string }
  | { type: 'mcp'; server_label: string };

/**
 * Transcription configuration for incoming user audio.
 */
export interface InworldInputTranscription {
  model?: string;
  language?: string;
  [key: string]: unknown;
}

/**
 * Voice activity detection / turn detection configuration. Inworld supports
 * both server-side VAD and a semantic-VAD mode with an "eagerness" knob.
 */
export interface InworldTurnDetection {
  type?: 'server_vad' | 'semantic_vad';
  threshold?: number;
  prefix_padding_ms?: number;
  silence_duration_ms?: number;
  /** Semantic-VAD only: how eagerly to end a user turn. */
  eagerness?: 'low' | 'medium' | 'high' | 'auto';
  create_response?: boolean;
  interrupt_response?: boolean;
  [key: string]: unknown;
}

export interface InworldAudioInput {
  format?: 'audio/pcm' | 'audio/pcmu' | 'audio/pcma';
  transcription?: InworldInputTranscription;
  turn_detection?: InworldTurnDetection | null;
  [key: string]: unknown;
}

export interface InworldAudioOutput {
  format?: 'audio/pcm' | 'audio/pcmu' | 'audio/pcma';
  /** Voice catalog ID (e.g. "Dennis", "Hades"). */
  voice?: string;
  /** Inworld TTS model (e.g. "inworld-tts-2"). */
  model?: string;
  /** Playback speed multiplier (0.25 to 1.5). */
  speed?: number;
  [key: string]: unknown;
}

export interface InworldAudioConfig {
  input?: InworldAudioInput;
  output?: InworldAudioOutput;
}

export interface InworldSessionConfig {
  model?: string;
  instructions?: string;
  output_modalities?: Array<'text' | 'audio'>;
  audio?: InworldAudioConfig;
  tools?: InworldTool[];
  tool_choice?: InworldToolChoice;
  temperature?: number;
  max_output_tokens?: number | 'inf';
  truncation?: 'auto' | 'disabled' | { type: 'retention_ratio'; retention_ratio: number };
  [key: string]: unknown;
}

/**
 * Per-response override for `response.create`. Inworld accepts the same audio
 * config nesting as the OpenAI Realtime GA spec.
 */
export interface InworldResponseConfig {
  instructions?: string;
  output_modalities?: Array<'text' | 'audio'>;
  audio?: InworldAudioConfig;
  tool_choice?: InworldToolChoice;
  temperature?: number;
  max_output_tokens?: number | 'inf';
  [key: string]: unknown;
}

export interface InworldFunctionCallOutput {
  type: 'function_call';
  call_id: string;
  name: string;
  arguments: string;
  [key: string]: unknown;
}

export interface InworldResponse {
  id: string;
  output?: Array<InworldFunctionCallOutput | Record<string, unknown>>;
  [key: string]: unknown;
}

/**
 * Typed event map for `InworldRealtimeVoice.on()` / `off()`.
 *
 * Standalone (not extending the base `VoiceEventMap`) because our
 * `speaking.audio` is a `Buffer` and the base types it as `string`. The
 * sibling `@mastra/voice-openai-realtime` package emits Buffers too and runs
 * with an entirely untyped `on()`; we add typed overloads on the subclass
 * directly so consumers get autocompletion without forcing the base type
 * upstream.
 *
 * Raw server passthroughs (`session.created`, `response.created`, etc.) are
 * typed as `Record<string, unknown>` because they mirror the wire payload
 * unchanged — narrow them at the call site if you need stricter types.
 */
export interface InworldVoiceEventMap {
  speaker: NodeJS.ReadableStream;
  speaking: { audio: Buffer; response_id: string };
  'speaking.done': { response_id: string };
  writing: { text: string; response_id: string; role: 'assistant' | 'user' };
  interrupted: { response_id: string };
  'speech-started': Record<string, unknown>;
  'speech-stopped': Record<string, unknown>;
  'function_call.arguments': { call_id: string; name: string; arguments: string };
  'tool-call-start': { toolCallId: string; toolName: string; toolDescription?: string; args: unknown };
  'tool-call-result': {
    toolCallId: string;
    toolName: string;
    toolDescription?: string;
    args: unknown;
    result: unknown;
  };
  error: Error | { message: string; code?: string; details?: unknown };
  'session.created': Record<string, unknown>;
  'session.updated': Record<string, unknown>;
  'response.created': Record<string, unknown>;
  'response.done': Record<string, unknown>;
  'conversation.item.added': Record<string, unknown>;
  'conversation.item.done': Record<string, unknown>;
  /** Forward-compat fallback for any raw event name not in this map. */
  [key: string]: unknown;
}
