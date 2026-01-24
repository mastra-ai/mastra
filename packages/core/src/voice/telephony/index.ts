/**
 * Telephony utilities for Mastra voice
 *
 * Provides:
 * - `TelephonySession` - Orchestrates telephony providers with voice-enabled agents
 * - Audio codec utilities for telephony formats (μ-law, A-law, PCM)
 *
 * @example
 * ```typescript
 * import { Agent } from '@mastra/core/agent';
 * import { TelephonySession, CompositeVoice } from '@mastra/core/voice';
 * import { OpenAIRealtimeVoice } from '@mastra/voice-openai-realtime';
 * import { TwilioVoice } from '@mastra/voice-twilio';
 *
 * // Create a voice-enabled agent
 * const agent = new Agent({
 *   name: 'Phone Agent',
 *   model: openai('gpt-4o'),
 *   instructions: 'You are a helpful assistant.',
 *   voice: new CompositeVoice({
 *     realtime: new OpenAIRealtimeVoice(),
 *   }),
 * });
 *
 * // Create session to connect telephony with the agent
 * const session = new TelephonySession({
 *   agent,
 *   telephony: new TwilioVoice(),
 *   bargeIn: true,
 * });
 *
 * session.on('ready', () => console.log('Call connected'));
 * await session.start();
 * ```
 */

// Session orchestration
export { TelephonySession } from './telephony-session';
export type { TelephonySessionConfig, TelephonySessionEvents, SessionState, Speaker } from './telephony-session';

// Audio codecs
export { mulawToPcm, pcmToMulaw, alawToPcm, pcmToAlaw, convertAudio } from './audio-codecs';
export type { AudioCodec } from './audio-codecs';
