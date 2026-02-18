/**
 * Type definitions for AWS Nova 2 Sonic voice integration
 */

import type { AwsCredentialIdentity } from '@smithy/types';

/**
 * Supported AWS regions for Nova 2 Sonic
 */
export type NovaSonicRegion = 'us-east-1' | 'us-west-2' | 'ap-northeast-1';

/**
 * Supported language codes for Nova 2 Sonic
 */
export type NovaSonicLanguageCode =
  | 'en-US'
  | 'en-GB'
  | 'en-IN'
  | 'en-AU'
  | 'fr-FR'
  | 'it-IT'
  | 'de-DE'
  | 'es-ES'
  | 'pt-BR'
  | 'hi-IN';


/**
 * Tool configuration for Nova 2 Sonic
 */
export interface NovaSonicToolConfig {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

/**
 * Voice configuration for Nova 2 Sonic
 * Supports polyglot voices that can speak multiple languages
 */
export interface NovaSonicVoiceConfigDetails {
  /** Voice name/identifier (e.g., 'matthew', 'tiffany', 'amy') */
  name?: string;
  /** Language code for the voice */
  languageCode?: NovaSonicLanguageCode;
  /** Gender preference (masculine or feminine) */
  gender?: 'masculine' | 'feminine';
}

/**
 * Session configuration for Nova 2 Sonic
 */
export interface NovaSonicSessionConfig {
  /** Inference configuration parameters */
  inferenceConfiguration?: {
    maxTokens?: number;
    topP?: number;
    temperature?: number;
    topK?: number;
    stopSequences?: string[];
  };
  /** System instructions for the model */
  instructions?: string;
  /** Tools available to the model */
  tools?: NovaSonicToolConfig[];
  /** Voice configuration */
  voice?: string | NovaSonicVoiceConfigDetails;
  /** Enable knowledge grounding with RAG */
  enableKnowledgeGrounding?: boolean;
  /** Knowledge base configuration */
  knowledgeBaseConfig?: {
    knowledgeBaseId?: string;
    dataSourceId?: string;
  };
  /** Turn-taking configuration */
  turnTaking?: {
    /** Voice activity detection sensitivity (deprecated - use turnDetectionConfiguration instead) */
    vadSensitivity?: number;
    /** Silence duration in milliseconds before ending turn */
    silenceDurationMs?: number;
  };
  /** Turn detection configuration for Nova 2 Sonic */
  turnDetectionConfiguration?: {
    /** Endpointing sensitivity: HIGH (fastest, 1.5s pause), MEDIUM (balanced, 1.75s pause), LOW (slowest, 2s pause) */
    endpointingSensitivity?: 'HIGH' | 'MEDIUM' | 'LOW';
  };
  /** Tool choice configuration */
  toolChoice?: 'auto' | 'any' | { tool: { name: string } };
}

/**
 * Configuration options for NovaSonicVoice
 */
export interface NovaSonicVoiceConfig {
  /** AWS region (default: us-east-1) */
  region?: NovaSonicRegion;
  /** AWS credentials (optional, uses default credential chain if not provided) */
  credentials?: AwsCredentialIdentity;
  /** Model ID (default: amazon.nova-2-sonic-v1:0) */
  model?: string;
  /** Voice configuration */
  speaker?: string | NovaSonicVoiceConfigDetails;
  /** Language code */
  languageCode?: NovaSonicLanguageCode;
  /** System instructions */
  instructions?: string;
  /** Tools available to the model */
  tools?: NovaSonicToolConfig[];
  /** Session configuration */
  sessionConfig?: NovaSonicSessionConfig;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Runtime options that can be passed to methods
 */
export interface NovaSonicVoiceOptions {
  /** Override the default speaker/voice */
  speaker?: string | NovaSonicVoiceConfigDetails;
  /** Language code for the response */
  languageCode?: NovaSonicLanguageCode;
}

/**
 * Event types emitted by NovaSonicVoice
 * Extends the base VoiceEventMap with Nova Sonic specific events
 */
export interface NovaSonicEventMap {
  /** Audio response stream - compatible with base VoiceEventMap */
  speaker: NodeJS.ReadableStream;
  /** Audio response with additional metadata */
  speaking: { audio?: string; audioData?: Int16Array; sampleRate?: number };
  /** Text response or transcription - compatible with base VoiceEventMap */
  writing: { text: string; role: 'assistant' | 'user' };
  /** Error events - compatible with base VoiceEventMap */
  error: { message: string; code?: string; details?: unknown };
  /** Session state changes */
  session: {
    state: 'connecting' | 'connected' | 'disconnected' | 'disconnecting' | 'error';
    config?: Record<string, unknown>;
  };
  /** Tool calls from the model */
  toolCall: { name: string; args: Record<string, any>; id: string };
  /** Voice activity detection events */
  vad: { type: 'start' | 'end'; timestamp: number };
  /** Interrupt events */
  interrupt: { type: 'user' | 'model'; timestamp: number };
  /** Token usage information */
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  /** Turn completion event */
  turnComplete: { timestamp: number };
  /** Allow any additional string keys for extensibility */
  [key: string]: unknown;
}

/**
 * AWS Nova 2 Sonic bidirectional streaming event types
 * Based on AWS Bedrock InvokeModelWithBidirectionalStream API
 */
export interface NovaSonicServerEvent {
  /** Content start event */
  contentStart?: {
    role?: 'ASSISTANT' | 'USER';
    additionalModelFields?: string; // JSON string with generationStage, etc.
  };
  /** Text output event */
  textOutput?: {
    content?: string;
    role?: 'ASSISTANT' | 'USER';
  };
  /** Audio output event */
  audioOutput?: {
    content?: string; // Base64 encoded audio
  };
  /** Tool use event */
  toolUse?: {
    toolName?: string;
    toolUseId?: string;
    input?: Record<string, any>;
  };
  /** Content end event */
  contentEnd?: {
    type?: 'TEXT' | 'AUDIO' | 'TOOL';
    stopReason?: string; // e.g., 'END_TURN', 'INTERRUPTED'
  };
  /** Completion end event */
  completionEnd?: {
    stopReason?: string;
    usage?: {
      inputTokens?: number;
      outputTokens?: number;
    };
  };
  /** Error event */
  error?: {
    code?: string;
    message?: string;
  };
}

/**
 * Client event types sent to AWS Nova 2 Sonic
 */
export interface NovaSonicClientEvent {
  /** Session start event */
  sessionStart?: {
    inferenceConfiguration?: {
      maxTokens?: number;
      topP?: number;
      temperature?: number;
      topK?: number;
      stopSequences?: string[];
    };
    turnTaking?: {
      vadSensitivity?: number;
      silenceDurationMs?: number;
    };
    turnDetectionConfiguration?: {
      endpointingSensitivity?: 'HIGH' | 'MEDIUM' | 'LOW';
    };
  };
  /** Prompt start event */
  promptStart?: {
    promptName: string;
    textOutputConfiguration?: {
      mediaType?: string;
    };
    audioOutputConfiguration?: {
      mediaType?: string;
      sampleRateHertz?: number;
      sampleSizeBits?: number;
      channelCount?: number;
      voiceId?: string;
      encoding?: string;
      audioType?: string;
    };
    tools?: Array<{
      name: string;
      description: string;
      inputSchema: {
        type: 'object';
        properties: Record<string, any>;
        required?: string[];
      };
    }>;
    toolChoice?: 'auto' | 'any' | { tool: { name: string } };
    knowledgeBaseConfig?: {
      knowledgeBaseId?: string;
      dataSourceId?: string;
    };
  };
  /** Content start event */
  contentStart?: {
    promptName: string;
    contentName: string;
    type: 'TEXT' | 'AUDIO';
    interactive?: boolean;
    role: 'SYSTEM' | 'USER' | 'ASSISTANT';
    textInputConfiguration?: {
      mediaType?: string;
    };
    audioInputConfiguration?: {
      mediaType?: string;
      sampleRateHertz?: number;
      sampleSizeBits?: number;
      channelCount?: number;
      encoding?: string;
      audioType?: string;
    };
  };
  /** Text input event */
  textInput?: {
    promptName: string;
    contentName: string;
    content: string;
  };
  /** Content end event */
  contentEnd?: {
    promptName: string;
    contentName: string;
  };
  /** Prompt end event */
  promptEnd?: {
    promptName: string;
  };
  /** Session end event */
  sessionEnd?: Record<string, unknown>;
  /** Audio input event (for streaming audio chunks) */
  audioInput?: {
    promptName: string;
    contentName: string;
    content: string; // Base64 encoded audio
  };
  /** Tool result */
  toolResult?: {
    toolUseId?: string;
    content?: Array<{
      text?: string;
      json?: Record<string, any>;
    }>;
  };
  /** Tool start */
  toolStart?: {
    toolUseId?: string;
  };
  /** Tool content end */
  toolContentEnd?: {
    toolUseId?: string;
  };
}

/**
 * Error codes for Nova Sonic specific errors
 */
export enum NovaSonicErrorCode {
  CONNECTION_FAILED = 'connection_failed',
  CONNECTION_NOT_ESTABLISHED = 'connection_not_established',
  AUTHENTICATION_FAILED = 'authentication_failed',
  CREDENTIALS_MISSING = 'credentials_missing',
  REGION_INVALID = 'region_invalid',
  WEBSOCKET_ERROR = 'websocket_error',
  AUDIO_PROCESSING_ERROR = 'audio_processing_error',
  AUDIO_STREAM_ERROR = 'audio_stream_error',
  SPEAKER_STREAM_ERROR = 'speaker_stream_error',
  TRANSCRIPTION_TIMEOUT = 'transcription_timeout',
  TRANSCRIPTION_FAILED = 'transcription_failed',
  TOOL_EXECUTION_ERROR = 'tool_execution_error',
  TOOL_NOT_FOUND = 'tool_not_found',
  SESSION_CONFIG_UPDATE_FAILED = 'session_config_update_failed',
  INVALID_AUDIO_FORMAT = 'invalid_audio_format',
  NOT_CONNECTED = 'not_connected',
  INVALID_STATE = 'invalid_state',
  VALIDATION_ERROR = 'validation_error',
  UNKNOWN_ERROR = 'unknown_error',
}

