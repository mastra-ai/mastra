/**
 * Nova Sonic Protocol Types
 *
 * These types define the JSON message format for Amazon Nova Sonic's bidirectional
 * streaming API. They are model-specific and NOT part of the AWS SDK - the SDK only
 * provides the transport layer (raw bytes).
 *
 * The actual protocol is documented at:
 * https://docs.aws.amazon.com/nova/latest/userguide/speech.html
 */

import type { PassThrough } from 'node:stream';

// =============================================================================
// Public Configuration Types
// =============================================================================

/**
 * Available Nova Sonic voice IDs
 */
export type NovaSonicVoiceId = 'tiffany' | 'amy' | 'matthew' | 'ruth' | string;

/**
 * Audio configuration for Nova Sonic
 */
export interface NovaSonicAudioConfig {
  /** Input sample rate in Hz @default 16000 */
  inputSampleRate?: number;
  /** Output sample rate in Hz @default 24000 */
  outputSampleRate?: number;
  /** Input audio format @default 'pcm' */
  inputFormat?: 'pcm';
  /** Output audio format @default 'pcm' */
  outputFormat?: 'pcm';
}

/**
 * Configuration for Amazon Nova Sonic voice provider
 */
export interface NovaSonicVoiceConfig {
  /** AWS region for Bedrock @default 'us-east-1' */
  region?: string;
  /** AWS access key ID (falls back to AWS_ACCESS_KEY_ID env var) */
  accessKeyId?: string;
  /** AWS secret access key (falls back to AWS_SECRET_ACCESS_KEY env var) */
  secretAccessKey?: string;
  /** AWS session token for temporary credentials */
  sessionToken?: string;
  /** Model ID to use @default 'amazon.nova-sonic-v1:0' */
  model?: string;
  /** Voice ID for speech output @default 'tiffany' */
  speaker?: NovaSonicVoiceId;
  /** System instructions for the voice assistant */
  instructions?: string;
  /** Enable debug logging @default false */
  debug?: boolean;
  /** Audio configuration */
  audioConfig?: NovaSonicAudioConfig;
}

// =============================================================================
// Internal Event Types
// =============================================================================

export type StreamWithId = PassThrough & { id: string };
export type EventCallback = (...args: unknown[]) => void;

/**
 * Event map for voice events emitted by NovaSonicVoice
 */
export type NovaSonicEventMap = {
  transcribing: [{ text: string }];
  writing: [{ text: string; role: 'assistant' | 'user' }];
  speaking: [{ audio: string; audioData?: Int16Array; sampleRate?: number }];
  speaker: [StreamWithId];
  error: [{ message: string; code?: string; details?: unknown }];
  session: [{ state: string; config?: Record<string, unknown> }];
  toolCall: [{ name: string; args: Record<string, unknown>; id: string }];
  'tool-call-start': [{ toolCallId: string; toolName: string; args: Record<string, unknown> }];
  'tool-call-result': [{ toolCallId: string; toolName: string; result: unknown }];
  turnComplete: [{ timestamp: number }];
} & {
  [key: string]: EventCallback[];
};

// =============================================================================
// Nova Sonic Protocol - Input Events
// These are the JSON structures sent TO the model (inside BidirectionalInputPayloadPart.bytes)
// =============================================================================

/** Session initialization with inference parameters */
export interface SessionStartEvent {
  event: {
    sessionStart: {
      inferenceConfiguration: {
        maxTokens: number;
        topP?: number;
        temperature?: number;
      };
    };
  };
}

/** Start a new prompt/conversation turn */
export interface PromptStartEvent {
  event: {
    promptStart: {
      promptName: string;
      textOutputConfiguration?: { mediaType: string };
      audioOutputConfiguration?: {
        mediaType: string;
        sampleRateHertz: number;
        voiceId: string;
      };
    };
  };
}

/** Start a content block (system, user, or assistant) */
export interface ContentBlockStartEvent {
  event: {
    contentBlockStart: {
      promptName: string;
      contentBlockIndex: number;
      contentBlockType: 'system' | 'user' | 'assistant';
    };
  };
}

/** Text input (for system prompts or user text) */
export interface TextInputEvent {
  event: {
    textInput: {
      promptName: string;
      contentBlockIndex: number;
      text: string;
    };
  };
}

/** Audio input (base64-encoded PCM audio) */
export interface AudioInputEvent {
  event: {
    audioInput: {
      promptName: string;
      contentBlockIndex: number;
      audio: string;
    };
  };
}

/** End a content block */
export interface ContentBlockStopEvent {
  event: {
    contentBlockStop: {
      promptName: string;
      contentBlockIndex: number;
    };
  };
}

/** Tool execution result */
export interface ToolResultEvent {
  event: {
    toolResult: {
      promptName: string;
      contentBlockIndex: number;
      toolUseId: string;
      result: string;
    };
  };
}

/** End the current prompt */
export interface PromptEndEvent {
  event: {
    promptEnd: {
      promptName: string;
    };
  };
}

/** End the session */
export interface SessionEndEvent {
  event: {
    sessionEnd: Record<string, never>;
  };
}

/** Union of all input event types */
export type NovaSonicInputEvent =
  | SessionStartEvent
  | PromptStartEvent
  | ContentBlockStartEvent
  | TextInputEvent
  | AudioInputEvent
  | ContentBlockStopEvent
  | ToolResultEvent
  | PromptEndEvent
  | SessionEndEvent;

// =============================================================================
// Nova Sonic Protocol - Output Events
// These are the JSON structures received FROM the model (inside BidirectionalOutputPayloadPart.bytes)
// =============================================================================

/** Model started a content block */
export interface OutputContentBlockStart {
  contentBlockStart: {
    contentBlockIndex: number;
    contentBlockType: 'text' | 'audio' | 'toolUse';
  };
}

/** Audio output (base64-encoded PCM audio) */
export interface OutputAudioContent {
  audioOutput: {
    contentBlockIndex: number;
    audio: string;
  };
}

/** Text output (transcription or response text) */
export interface OutputTextContent {
  textOutput: {
    contentBlockIndex: number;
    text: string;
  };
}

/** Tool invocation request */
export interface OutputToolUse {
  toolUse: {
    contentBlockIndex: number;
    toolUseId: string;
    toolName: string;
    input: string; // JSON string
  };
}

/** Model ended a content block */
export interface OutputContentBlockStop {
  contentBlockStop: {
    contentBlockIndex: number;
  };
}

/** Model turn ended */
export interface OutputTurnEnd {
  turnEnd: {
    stopReason: string;
  };
}

/** Error from model */
export interface OutputError {
  error: {
    message: string;
    code?: string;
  };
}

/** Union of all output event types */
export type NovaSonicOutputEvent =
  | OutputContentBlockStart
  | OutputAudioContent
  | OutputTextContent
  | OutputToolUse
  | OutputContentBlockStop
  | OutputTurnEnd
  | OutputError;

// =============================================================================
// Constants
// =============================================================================

export const DEFAULT_MODEL = 'amazon.nova-sonic-v1:0';
export const DEFAULT_VOICE: NovaSonicVoiceId = 'tiffany';
export const DEFAULT_REGION = 'us-east-1';

export const DEFAULT_AUDIO_CONFIG: NovaSonicAudioConfig = {
  inputSampleRate: 16000,
  outputSampleRate: 24000,
  inputFormat: 'pcm',
  outputFormat: 'pcm',
};

export const VOICES: Array<{ voiceId: NovaSonicVoiceId; description: string }> = [
  { voiceId: 'tiffany', description: 'Default female voice - clear and professional' },
  { voiceId: 'amy', description: 'Female voice - warm and conversational' },
  { voiceId: 'matthew', description: 'Male voice - confident and articulate' },
  { voiceId: 'ruth', description: 'Female voice - friendly and approachable' },
];
