/**
 * Google Gemini Live API integration for Mastra
 * 
 * This module provides real-time multimodal voice interactions using Google's Gemini Live API.
 * It supports bidirectional audio streaming, video input, tool calling, and session management.
 */

export { GeminiLiveVoice } from './gemini-live-voice';
export type {
  GeminiLiveVoiceConfig,
  GeminiLiveVoiceOptions,
  GeminiVoiceModel,
  GeminiVoiceName,
  GeminiSessionConfig,
  GeminiToolConfig,
} from './types';