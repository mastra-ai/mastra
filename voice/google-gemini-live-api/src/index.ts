/**
 * Google Gemini Live API integration for Mastra
 * 
 * This module provides real-time multimodal voice interactions using Google's Gemini Live API.
 * It supports bidirectional audio streaming, video input, tool calling, and session management.
 * 
 * Authentication:
 * - Gemini API: Use an API key from Google AI Studio
 * - Vertex AI: Use OAuth with service account or Application Default Credentials (ADC)
 * 
 * @example Gemini API
 * ```typescript
 * import { GeminiLiveVoice } from '@mastra/voice-google-gemini-live';
 * 
 * const voice = new GeminiLiveVoice({
 *   apiKey: 'your-api-key',
 * });
 * ```
 * 
 * @example Vertex AI with ADC
 * ```typescript
 * import { GeminiLiveVoice } from '@mastra/voice-google-gemini-live';
 * 
 * const voice = new GeminiLiveVoice({
 *   vertexAI: true,
 *   project: 'your-project-id',
 *   location: 'us-central1',
 * });
 * ```
 * 
 * @example Vertex AI with Service Account
 * ```typescript
 * import { GeminiLiveVoice } from '@mastra/voice-google-gemini-live';
 * 
 * const voice = new GeminiLiveVoice({
 *   vertexAI: true,
 *   project: 'your-project-id',
 *   location: 'us-central1',
 *   serviceAccountKeyFile: '/path/to/service-account.json',
 * });
 * ```
 * 
 * @example Dynamic Configuration Updates
 * ```typescript
 * // Connect first
 * await voice.connect();
 * 
 * // Update configuration during session
 * await voice.updateSessionConfig({
 *   speaker: 'Charon',
 *   instructions: 'You are a helpful assistant',
 *   tools: [
 *     {
 *       name: 'get_weather',
 *       description: 'Get weather information',
 *       parameters: {
 *         type: 'object',
 *         properties: {
 *           location: { type: 'string' }
 *         }
 *       }
 *     }
 *   ]
 * });
 * ```
 */

export { GeminiLiveVoice } from './gemini-live-voice';
export type {
  GeminiLiveVoiceConfig,
  GeminiLiveVoiceOptions,
  GeminiVoiceModel,
  GeminiVoiceName,
  GeminiSessionConfig,
  GeminiToolConfig,
  GeminiLiveEventMap,
  GeminiLiveMessage,
  AudioConfig,
  VideoConfig,
  GeminiLiveServerMessage,
  AuthOptions,
} from './types';