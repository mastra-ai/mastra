/**
 * Type definitions for Google Gemini Live API integration
 */

/**
 * Available Gemini Live API models
 */
export type GeminiVoiceModel = 
  | 'gemini-2.0-flash-live-001'
  | 'gemini-2.5-flash-preview-native-audio-dialog'
  | 'gemini-2.5-flash-exp-native-audio-thinking-dialog'
  | 'gemini-live-2.5-flash-preview';

/**
 * Available voice options for Gemini Live API
 */
export type GeminiVoiceName = 
  | 'Puck'
  | 'Charon' 
  | 'Kore'
  | 'Fenrir';

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
  /** Google API key (falls back to GOOGLE_API_KEY env var) */
  apiKey?: string;
  /** Model to use for the Live API */
  model?: GeminiVoiceModel;
  /** Voice to use for speech synthesis */
  speaker?: GeminiVoiceName;
  /** Use Vertex AI instead of Gemini API */
  vertexAI?: boolean;
  /** Google Cloud project ID (required for Vertex AI) */
  project?: string;
  /** Google Cloud region (defaults to us-central1) */
  location?: string;
  /** System instructions for the model */
  instructions?: string;
  /** Tools available to the model */
  tools?: GeminiToolConfig[];
  /** Session configuration */
  sessionConfig?: GeminiSessionConfig;
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
  session: { state: 'connecting' | 'connected' | 'disconnected' | 'error' };
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
  /** Allow any additional string keys for extensibility */
  [key: string]: unknown;
}

/**
 * WebSocket message types for the Live API
 */
export interface GeminiLiveMessage {
  type: string;
  data?: any;
  metadata?: Record<string, any>;
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