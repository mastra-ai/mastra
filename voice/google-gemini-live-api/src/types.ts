/**
 * Type definitions for Google Gemini Live API integration
 */

/**
 * Available Gemini Live API models
 */
export type GeminiVoiceModel =
  | 'gemini-2.0-flash-exp'
  | 'gemini-2.0-flash-exp-image-generation'
  | 'gemini-2.0-flash-live-001'
  | 'gemini-live-2.5-flash-preview-native-audio'
  | 'gemini-2.5-flash-exp-native-audio-thinking-dialog'
  | 'gemini-live-2.5-flash-preview'
  | 'gemini-2.6.flash-preview-tts';

/**
 * Available voice options for Gemini Live API
 */
export type GeminiVoiceName = 'Puck' | 'Charon' | 'Kore' | 'Fenrir';

/**
 * Tool configuration for Gemini Live API
 */
export interface GeminiToolConfig {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

/**
 * Session configuration for connection management
 */
export interface GeminiSessionConfig {
  /** Enable session resumption after network interruptions */
  enableResumption?: boolean;
  /** Maximum session duration (e.g., '24h', '2h') */
  maxDuration?: string;
  /** Enable automatic context compression */
  contextCompression?: boolean;
  /** Voice Activity Detection settings */
  vad?: {
    enabled?: boolean;
    sensitivity?: number;
    silenceDurationMs?: number;
  };
  /** Interrupt handling configuration */
  interrupts?: {
    enabled?: boolean;
    allowUserInterruption?: boolean;
  };
}

/**
 * Configuration options for GeminiLiveVoice
 */
export interface GeminiLiveVoiceConfig {
  /** Google API key */
  apiKey?: string;
  /** Model to use for the Live API */
  model?: GeminiVoiceModel;
  /** Voice to use for speech synthesis */
  speaker?: GeminiVoiceName;
  /** Use Vertex AI instead of Gemini API */
  vertexAI?: boolean;
  /** Google Cloud project ID (required for Vertex AI) */
  project?: string;
  /** Token expiration time in seconds (defaults to 50 minutes) */
  tokenExpirationTime?: number;
  /** Google Cloud region (defaults to us-central1) */
  location?: string;
  /**
   * Path to service account JSON key file for Vertex AI authentication.
   * If not provided, will use Application Default Credentials (ADC).
   */
  serviceAccountKeyFile?: string;
  /**
   * Service account email for impersonation.
   * Useful when you want to use a specific service account without a key file.
   */
  serviceAccountEmail?: string;
  /** System instructions for the model */
  instructions?: string;
  /** Tools available to the model */
  tools?: GeminiToolConfig[];
  /** Session configuration */
  sessionConfig?: GeminiSessionConfig;
  /** Audio configuration for input/output */
  audioConfig?: Partial<AudioConfig>;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Runtime options that can be passed to methods
 */
export interface GeminiLiveVoiceOptions {
  /** Override the default speaker */
  speaker?: GeminiVoiceName;
  /** Language code for the response */
  languageCode?: string;
  /** Response modalities (audio, text, or both) */
  responseModalities?: ('AUDIO' | 'TEXT')[];
}

/**
 * Event types emitted by GeminiLiveVoice
 * Extends the base VoiceEventMap with Gemini Live specific events
 */
export interface GeminiLiveEventMap {
  /** Audio response from the model - compatible with base VoiceEventMap */
  speaker: NodeJS.ReadableStream;
  /** Audio response with additional metadata */
  speaking: { audio?: string; audioData?: Int16Array; sampleRate?: number };
  /** Text response or transcription - compatible with base VoiceEventMap */
  writing: { text: string; role: 'assistant' | 'user' };
  /** Error events - compatible with base VoiceEventMap */
  error: { message: string; code?: string; details?: unknown };
  /** Session state changes */
  session: {
    state: 'connecting' | 'connected' | 'disconnected' | 'disconnecting' | 'error' | 'updated';
    config?: Record<string, unknown>; // Configuration data when state is 'updated' or 'connected'
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
    modality: 'audio' | 'text' | 'video';
  };
  /** Session resumption handle */
  sessionHandle: { handle: string; expiresAt: Date };
  /** Session expiring warning */
  sessionExpiring: { expiresIn: number; sessionId?: string };
  /** Turn completion event */
  turnComplete: { timestamp: number };
  /** Allow any additional string keys for extensibility */
  [key: string]: unknown;
}

/**
 * WebSocket message types for the Live API
 */
export interface GeminiLiveMessage {
  type: string;
  data?: unknown;
  metadata?: Record<string, unknown>;
}

/**
 * Configuration for audio processing
 */
export interface AudioConfig {
  /** Input sample rate (16kHz for input) */
  inputSampleRate: number;
  /** Output sample rate (24kHz for output) */
  outputSampleRate: number;
  /** Audio encoding format */
  encoding: 'pcm16' | 'pcm24';
  /** Number of audio channels */
  channels: 1;
}

/**
 * Video configuration options
 */
export interface VideoConfig {
  /** Video resolution (e.g., '1024x1024') */
  resolution: string;
  /** Video format */
  format: 'jpeg' | 'png';
  /** Frame rate */
  frameRate: number;
}

// Define message types for Gemini Live API based on official documentation
// https://ai.google.dev/api/live

export interface GeminiLiveServerMessage {
  // Server messages may have a usageMetadata field but will otherwise include
  // exactly one of the other fields from BidiGenerateContentServerMessage
  usageMetadata?: {
    promptTokenCount?: number;
    cachedContentTokenCount?: number;
    responseTokenCount?: number;
    toolUsePromptTokenCount?: number;
    thoughtsTokenCount?: number;
    totalTokenCount?: number;
    promptTokensDetails?: Array<{
      modality?: string;
      tokenCount?: number;
    }>;
    cacheTokensDetails?: Array<{
      modality?: string;
      tokenCount?: number;
    }>;
    responseTokensDetails?: Array<{
      modality?: string;
      tokenCount?: number;
    }>;
  };

  // Setup completion message
  setup?: {
    sessionHandle?: string;
  };

  // Setup complete message (alternative format)
  setupComplete?: Record<string, unknown>;

  // Server content (model responses)
  serverContent?: {
    modelTurn?: {
      parts?: Array<{
        text?: string;
        inlineData?: {
          mimeType?: string;
          data?: string;
        };
      }>;
    };
    turnComplete?: boolean;
  };

  // Tool call requests
  toolCall?: {
    name?: string;
    args?: Record<string, unknown>;
    id?: string;
  };

  // Session end
  sessionEnd?: {
    reason?: string;
  };

  // Error messages
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

// Auth options for Google Auth client for Vertex AI
export interface AuthOptions {
  scopes: string[];
  projectId?: string;
  keyFilename?: string;
  tokenExpirationTime?: number;
  clientOptions?: {
    subject?: string;
  };
}

export enum GeminiLiveErrorCode {
  CONNECTION_FAILED = 'connection_failed',
  CONNECTION_NOT_ESTABLISHED = 'connection_not_established',
  AUTHENTICATION_FAILED = 'authentication_failed',
  API_KEY_MISSING = 'api_key_missing',
  PROJECT_ID_MISSING = 'project_id_missing',
  WEBSOCKET_ERROR = 'websocket_error',
  AUDIO_PROCESSING_ERROR = 'audio_processing_error',
  AUDIO_STREAM_ERROR = 'audio_stream_error',
  SPEAKER_STREAM_ERROR = 'speaker_stream_error',
  TRANSCRIPTION_TIMEOUT = 'transcription_timeout',
  TRANSCRIPTION_FAILED = 'transcription_failed',
  TOOL_EXECUTION_ERROR = 'tool_execution_error',
  TOOL_NOT_FOUND = 'tool_not_found',
  SESSION_CONFIG_UPDATE_FAILED = 'session_config_update_failed',
  SESSION_RESUMPTION_FAILED = 'session_resumption_failed',
  INVALID_AUDIO_FORMAT = 'invalid_audio_format',
  STREAM_LIMIT_EXCEEDED = 'stream_limit_exceeded',
  NOT_CONNECTED = 'not_connected',
  INVALID_STATE = 'invalid_state',
  UNKNOWN_ERROR = 'unknown_error',
}

export interface UpdateMessage {
  type: string;
  session: {
    generation_config?: {
      /** Which modalities the model should respond with for this turn */
      response_modalities?: ('AUDIO' | 'TEXT')[];
      speech_config?: {
        /** Optional language code for synthesized speech */
        language_code?: string;
        voice_config?: {
          prebuilt_voice_config?: {
            voice_name: string;
          };
        };
      };
    };
    system_instruction?: {
      parts: Array<{ text: string }>;
    };
    tools?: Array<{
      function_declarations: Array<{
        name: string;
        description?: string;
        parameters?: unknown;
      }>;
    }>;
    vad?: {
      enabled: boolean;
      sensitivity?: number;
      silence_duration_ms?: number;
    };
    interrupts?: {
      enabled: boolean;
      allow_user_interruption?: boolean;
    };
    context_compression?: boolean;
  };
}
