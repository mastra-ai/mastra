import type { VoiceEventMap } from '@internal/voice';

export type XAIRealtimeModel = 'grok-voice-think-fast-1.0' | 'grok-voice-fast-1.0' | (string & {});

export type XAIVoice = 'eve' | 'ara' | 'rex' | 'sal' | 'leo' | (string & {});

export type XAIAudioFormatType = 'audio/pcm' | 'audio/pcmu' | 'audio/pcma';

export type XAIPCMSampleRate = 8000 | 16000 | 22050 | 24000 | 32000 | 44100 | 48000;

export type XAIAudioFormat =
  | {
      type: 'audio/pcm';
      rate?: XAIPCMSampleRate;
    }
  | {
      type: 'audio/pcmu' | 'audio/pcma';
      rate?: 8000;
    };

export interface XAIAudioConfig {
  input?: {
    format?: XAIAudioFormat;
  };
  output?: {
    format?: XAIAudioFormat;
  };
}

export interface XAITurnDetection {
  type: 'server_vad' | null;
  threshold?: number;
  silence_duration_ms?: number;
  prefix_padding_ms?: number;
}

export interface XAIFunctionTool {
  type: 'function';
  name: string;
  description?: string;
  parameters: Record<string, unknown>;
}

export interface XAIFileSearchTool {
  type: 'file_search';
  vector_store_ids: string[];
  max_num_results?: number;
}

export interface XAIWebSearchTool {
  type: 'web_search';
}

export interface XAIXSearchTool {
  type: 'x_search';
  allowed_x_handles?: string[];
}

export interface XAIMCPTool {
  type: 'mcp';
  server_url: string;
  server_label: string;
  server_description?: string;
  allowed_tools?: string[];
  authorization?: string;
  headers?: Record<string, string>;
}

export type XAIServerTool = XAIFileSearchTool | XAIWebSearchTool | XAIXSearchTool | XAIMCPTool;

export type XAITool = XAIFunctionTool | XAIServerTool;

export interface XAISessionConfig {
  instructions?: string;
  voice?: XAIVoice;
  turn_detection?: XAITurnDetection;
  audio?: XAIAudioConfig;
  tools?: XAITool[];
  [key: string]: unknown;
}

export interface XAIRealtimeVoiceConfig {
  apiKey?: string;
  ephemeralToken?: string;
  model?: XAIRealtimeModel;
  url?: string;
  speaker?: XAIVoice;
  instructions?: string;
  turnDetection?: XAITurnDetection;
  audio?: XAIAudioConfig;
  serverTools?: XAIServerTool[];
  session?: Omit<XAISessionConfig, 'instructions' | 'voice' | 'tools'> & {
    tools?: XAIServerTool[];
  };
  debug?: boolean;
}

export interface XAIRealtimeSpeakOptions {
  speaker?: XAIVoice;
  response?: Record<string, unknown>;
}

export interface XAIRealtimeListenOptions {
  commit?: boolean;
  createResponse?: boolean;
  response?: Record<string, unknown>;
}

export interface XAIRealtimeAnswerOptions {
  response?: Record<string, unknown>;
}

export interface XAIRealtimeEventMap extends VoiceEventMap {
  speaker: NodeJS.ReadableStream;
  speaking: { audio?: string; audioData?: Buffer; response_id?: string };
  writing: { text: string; role: 'assistant' | 'user'; response_id?: string };
  error: { message: string; code?: string; details?: unknown };
  'speaking.done': { response_id?: string };
  'tool-call-start': { toolCallId: string; toolName: string; toolDescription?: string; args: unknown };
  'tool-call-result': {
    toolCallId: string;
    toolName: string;
    toolDescription?: string;
    args: unknown;
    result: unknown;
  };
  [key: string]: unknown;
}

export interface XAISpeaker {
  voiceId: string;
  name: string;
  gender?: 'female' | 'male' | 'neutral';
  description: string;
}

export type XAIClientEvent =
  | { type: 'session.update'; session: XAISessionConfig }
  | { type: 'conversation.item.create'; item: Record<string, unknown> }
  | { type: 'input_audio_buffer.append'; audio: string; event_id?: string }
  | { type: 'input_audio_buffer.commit'; event_id?: string }
  | { type: 'input_audio_buffer.clear'; event_id?: string }
  | { type: 'response.create'; response?: Record<string, unknown> }
  | { type: 'response.cancel'; response_id?: string; event_id?: string }
  | ({ type: string } & Record<string, unknown>);

export interface XAIServerEvent {
  type: string;
  response_id?: string;
  item_id?: string;
  call_id?: string;
  name?: string;
  arguments?: string;
  delta?: string;
  transcript?: string;
  text?: string;
  error?: {
    message?: string;
    code?: string;
    type?: string;
    [key: string]: unknown;
  };
  response?: {
    id?: string;
    output?: Array<Record<string, unknown>>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}
