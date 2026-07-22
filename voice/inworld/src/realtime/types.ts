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
  | 'input_audio_buffer.turn_suggestion'
  | 'input_audio_buffer.turn_suggestion_revoked'
  | 'input_audio_buffer.timeout_triggered'
  | 'output_audio_buffer.started'
  | 'output_audio_buffer.stopped'
  | 'output_audio_buffer.cleared'
  | 'error';

export interface InworldTool {
  type: 'function';
  name: string;
  description?: string;
  parameters: Record<string, unknown>;
}

export type InworldToolChoice =
  'auto' | 'none' | 'required' | { type: 'function'; name: string } | { type: 'mcp'; server_label: string };

/**
 * Transcription configuration for incoming user audio.
 */
export interface InworldInputTranscription {
  model?: string;
  language?: string;
  /** Optional prompt to bias transcription (vocabulary, spelling, style). */
  prompt?: string;
  [key: string]: unknown;
}

/** Input noise-reduction mode applied before transcription/VAD. */
export interface InworldNoiseReduction {
  type: 'near_field' | 'far_field';
}

/**
 * Audio format for `audio.input.format` / `audio.output.format`. Accepts a
 * codec string or an object with an optional sample `rate` (Hz). `rate` applies
 * to `audio/pcm` and `audio/float32` (default 24000); `audio/pcmu` and
 * `audio/pcma` are fixed at 8000.
 */
export type InworldAudioFormat =
  | 'audio/pcm'
  | 'audio/pcmu'
  | 'audio/pcma'
  | 'audio/float32'
  | 'pcm16'
  | 'g711_ulaw'
  | 'g711_alaw'
  | 'float32'
  | { type: 'audio/pcm' | 'audio/pcmu' | 'audio/pcma' | 'audio/float32'; rate?: number };

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
  /** `server_vad` only: idle window before the server commits a user turn. */
  idle_timeout_ms?: number;
  create_response?: boolean;
  interrupt_response?: boolean;
  [key: string]: unknown;
}

export interface InworldAudioInput {
  format?: InworldAudioFormat;
  transcription?: InworldInputTranscription;
  turn_detection?: InworldTurnDetection | null;
  noise_reduction?: InworldNoiseReduction;
  [key: string]: unknown;
}

export interface InworldAudioOutput {
  format?: InworldAudioFormat;
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

/**
 * STT (speech-to-text) tuning sent under `session.providerData.stt`. These are
 * Inworld-specific knobs layered on top of the standard
 * `audio.input.transcription` config.
 */
export interface InworldSttProviderData {
  prompt?: string;
  voice_profile?: boolean;
  language_hints?: string[];
  end_of_turn_confidence_threshold?: number;
  vad_threshold?: number;
  min_end_of_turn_silence?: number;
  max_turn_silence?: number;
  [key: string]: unknown;
}

/**
 * TTS (text-to-speech) tuning sent under `session.providerData.tts`. Controls
 * segmentation, steering, and delivery of synthesized speech.
 */
export interface InworldTtsProviderData {
  segmenter_strategy?:
    'auto' | 'balanced' | 'sentence' | 'full_turn' | 'fast_start' | 'per_segment_context' | (string & {});
  steering_handling?: 'repeat_each_chunk' | 'emit_once' | (string & {});
  language?: string;
  delivery_mode?: 'STABLE' | 'BALANCED' | 'CREATIVE' | (string & {});
  conversational?: boolean;
  user_turn_mode?: 'both' | 'audio_only' | 'text_only' | 'none' | (string & {});
  [key: string]: unknown;
}

/**
 * Automatic memory config sent under `session.providerData.memory`. Inworld
 * maintains a rolling summary/facts state and surfaces it back via the
 * `memory` event.
 */
export interface InworldMemoryProviderData {
  enabled?: boolean;
  turn_interval?: number;
  max_memory_length?: number;
  max_transcript_items?: number;
  max_facts?: number;
  trim_after_summarize?: boolean;
  state?: InworldMemoryState;
  [key: string]: unknown;
}

/**
 * Back-channel config sent under `session.providerData.backchannel`. Controls
 * when and how the model emits short acknowledgements ("uh-huh", "right")
 * while the user is speaking.
 */
export interface InworldBackchannelProviderData {
  enabled?: boolean;
  small_model?: string;
  eval_interval_ms?: number;
  min_speech_ms?: number;
  min_gap_ms?: number;
  max_per_turn?: number;
  hard_deadline_ms?: number;
  history_tail_items?: number;
  temperature?: number;
  max_tokens?: number;
  volume_gain?: number;
  require_pause?: boolean;
  allowed_phrases?: string[];
  prompt_template?: string;
  decider_kind?: 'llm' | 'rule';
  rule_fire_probability?: number;
  [key: string]: unknown;
}

/**
 * Responsiveness config sent under `session.providerData.responsiveness`.
 * Drives early "filler" audio while the main response is still generating.
 * Filler audio reuses the normal `response.output_audio.delta` path — there
 * are no distinct inbound events.
 */
export interface InworldResponsivenessProviderData {
  enabled?: boolean;
  small_model?: string;
  initial_wait_timeout_ms?: number;
  hard_deadline_ms?: number;
  history_tail_items?: number;
  temperature?: number;
  max_tokens?: number;
  min_filler_gap_ms?: number;
  max_initial_per_turn?: number;
  max_buffer_deltas?: number;
  enable_filler_on_first_assistant_reply?: boolean;
  prompt_template?: string;
  pause_text?: string;
  [key: string]: unknown;
}

/**
 * Typed Inworld extension object sent under `session.providerData` in every
 * `session.update`. Groups the provider-specific knobs (stt/tts/memory/
 * backchannel/responsiveness) plus session-level `user_id`/`metadata`.
 */
export interface InworldProviderData {
  stt?: InworldSttProviderData;
  tts?: InworldTtsProviderData;
  memory?: InworldMemoryProviderData;
  backchannel?: InworldBackchannelProviderData;
  responsiveness?: InworldResponsivenessProviderData;
  user_id?: string;
  metadata?: Record<string, string>;
  [key: string]: unknown;
}

/** A single classified label from Inworld's voice-profile analysis. */
export interface InworldVoiceProfileLabel {
  label: string;
  confidence: number;
}

/**
 * Voice profile surfaced on user `writing` events when `stt.voice_profile` is
 * enabled. Each dimension is a ranked list of classified labels.
 */
export interface InworldVoiceProfile {
  age?: InworldVoiceProfileLabel[];
  gender?: InworldVoiceProfileLabel[];
  emotion?: InworldVoiceProfileLabel[];
  vocal_style?: InworldVoiceProfileLabel[];
  accent?: InworldVoiceProfileLabel[];
  [key: string]: InworldVoiceProfileLabel[] | undefined;
}

/**
 * Rolling memory state Inworld maintains across the conversation. Surfaced via
 * the `memory` event and echoed back on `session.providerData.memory.state`.
 */
export interface InworldMemoryState {
  version?: number;
  facts?: string[];
  summary?: string;
  context_text?: string;
  turns_since_gen?: number;
  total_turns?: number;
  items_trimmed?: number;
  [key: string]: unknown;
}

/**
 * Distributed-tracing config. `'auto'` lets the server pick defaults; the
 * object form names the workflow/group and attaches arbitrary metadata.
 */
export type InworldTracing = 'auto' | { workflow_name?: string; group_id?: string; metadata?: Record<string, unknown> };

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
  /** Distributed-tracing config (`'auto'` or an explicit workflow/group object). */
  tracing?: InworldTracing;
  /** Opt-in extra fields the server should include on emitted events. */
  include?: Array<'item.input_audio_transcription.logprobs'>;
  /** Reference to a server-side prompt template; `null` clears it. */
  prompt?: string | null;
  /** Typed Inworld extension object, sent verbatim under `session.providerData`. */
  providerData?: InworldProviderData;
  [key: string]: unknown;
}

/**
 * Per-response override for `response.create`. Per the schema's `ResponseConfig`,
 * the voice override is a FLAT `voice` field (not nested under `audio.output`),
 * and there is no per-response `audio` config.
 */
export interface InworldResponseConfig {
  conversation?: 'auto' | string;
  output_modalities?: Array<'text' | 'audio'>;
  instructions?: string;
  /** Per-response voice override. Flat field — NOT nested under `audio.output`. */
  voice?: string;
  max_output_tokens?: number | 'inf';
  tool_choice?: InworldToolChoice;
  tools?: InworldTool[];
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
  writing: { text: string; response_id: string; role: 'assistant' | 'user'; voiceProfile?: InworldVoiceProfile };
  interrupted: { response_id: string };
  /** Rolling summary/facts state Inworld maintains, deduped by version. */
  memory: InworldMemoryState;
  /** PassThrough stream of back-channel PCM audio. Mirrors `speaker`. */
  backchannel: NodeJS.ReadableStream;
  'backchannel.done': { backchannel_id: string; phrase?: string };
  'backchannel.skipped': { reason: string };
  'speech-started': Record<string, unknown>;
  'speech-stopped': Record<string, unknown>;
  /** Smart-turn endpointing suggestion for a buffered user utterance. */
  'turn-suggestion': {
    item_id: string;
    utterance_index: number;
    probability: number;
    trailing_silence_ms?: number;
    audio_duration_ms?: number;
    inference_ms?: number;
  };
  /** A previously emitted turn suggestion was retracted. */
  'turn-suggestion-revoked': { item_id: string; utterance_index: number };
  /** Buffered input audio was committed as a user turn. */
  'input-committed': { item_id: string; previous_item_id?: string | null };
  /** Buffered input audio was discarded. */
  'input-cleared': Record<string, never>;
  /** Server-VAD idle timeout committed (or would have committed) a user turn. */
  'input-timeout': { audio_start_ms: number; audio_end_ms: number; item_id: string };
  /** Server began emitting output audio (playback should start). */
  'output-audio-started': Record<string, never>;
  /** Server stopped emitting output audio for the current response. */
  'output-audio-stopped': Record<string, never>;
  /** Server's output audio buffer was flushed (playback stopped). */
  'output-audio-cleared': Record<string, never>;
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
