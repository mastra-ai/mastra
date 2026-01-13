/**
 * Telephony utilities for Mastra voice
 *
 * Provides:
 * - `TelephonySession` - Orchestrates telephony and AI voice providers
 * - Audio codec utilities for telephony formats (μ-law, A-law, PCM)
 *
 * @example
 * ```typescript
 * import { TelephonySession, mulawToPcm, pcmToMulaw } from '@mastra/core/voice';
 * import { OpenAIRealtimeVoice } from '@mastra/voice-openai-realtime';
 *
 * // Create session to orchestrate telephony and AI providers
 * const session = new TelephonySession({
 *   telephony: myTelephonyProvider,  // Your MastraVoice implementation
 *   ai: new OpenAIRealtimeVoice(),
 *   agent: myAgent,
 *   bargeIn: true,
 * });
 *
 * session.on('ready', () => console.log('Call connected'));
 * session.on('barge-in', () => console.log('User interrupted'));
 * await session.start();
 * ```
 */

// Session orchestration
export { TelephonySession } from './telephony-session';
export type { TelephonySessionConfig, TelephonySessionEvents, SessionState, Speaker } from './telephony-session';

// Audio codecs
export { mulawToPcm, pcmToMulaw, alawToPcm, pcmToAlaw, convertAudio } from './audio-codecs';
export type { AudioCodec } from './audio-codecs';
