/**
 * Audio codec utilities for telephony
 *
 * PSTN (Public Switched Telephone Network) uses specific audio formats:
 * - μ-law (mulaw): 8-bit compressed audio at 8kHz, used in North America/Japan
 * - A-law: Similar compression used in Europe and rest of world
 *
 * AI voice providers typically use:
 * - PCM: 16-bit signed linear audio at 16kHz or higher
 *
 * This module provides conversion utilities between these formats using
 * the `alawmulaw` library for accurate codec implementation.
 */

import alawmulaw from 'alawmulaw';

/**
 * Convert μ-law encoded audio to 16-bit PCM
 *
 * @param mulawBuffer - Buffer containing μ-law encoded audio (8-bit, 8kHz)
 * @returns Int16Array containing PCM audio (16-bit signed)
 *
 * @example
 * ```typescript
 * const pcmAudio = mulawToPcm(twilioAudioBuffer);
 * openaiVoice.send(pcmAudio);
 * ```
 */
export function mulawToPcm(mulawBuffer: Buffer): Int16Array {
  return alawmulaw.mulaw.decode(new Uint8Array(mulawBuffer));
}

/**
 * Convert 16-bit PCM audio to μ-law encoding
 *
 * @param pcm - Int16Array containing PCM audio (16-bit signed)
 * @returns Buffer containing μ-law encoded audio (8-bit)
 *
 * @example
 * ```typescript
 * openaiVoice.on('audio', (pcmAudio) => {
 *   const mulawAudio = pcmToMulaw(pcmAudio);
 *   twilioVoice.sendRaw(streamSid, mulawAudio);
 * });
 * ```
 */
export function pcmToMulaw(pcm: Int16Array): Buffer {
  return Buffer.from(alawmulaw.mulaw.encode(pcm));
}

/**
 * Convert A-law encoded audio to 16-bit PCM
 *
 * @param alawBuffer - Buffer containing A-law encoded audio (8-bit, 8kHz)
 * @returns Int16Array containing PCM audio (16-bit signed)
 */
export function alawToPcm(alawBuffer: Buffer): Int16Array {
  return alawmulaw.alaw.decode(new Uint8Array(alawBuffer));
}

/**
 * Convert 16-bit PCM audio to A-law encoding
 *
 * @param pcm - Int16Array containing PCM audio (16-bit signed)
 * @returns Buffer containing A-law encoded audio (8-bit)
 */
export function pcmToAlaw(pcm: Int16Array): Buffer {
  return Buffer.from(alawmulaw.alaw.encode(pcm));
}

/**
 * Audio codec types supported by telephony providers
 */
export type AudioCodec = 'mulaw' | 'alaw' | 'pcm';

/**
 * Convert audio between codecs
 *
 * @param audio - Input audio buffer
 * @param fromCodec - Source codec
 * @param toCodec - Target codec
 * @returns Converted audio
 */
export function convertAudio(
  audio: Buffer | Int16Array,
  fromCodec: AudioCodec,
  toCodec: AudioCodec,
): Buffer | Int16Array {
  if (fromCodec === toCodec) {
    return audio;
  }

  // First convert to PCM if needed
  let pcm: Int16Array;
  if (fromCodec === 'pcm') {
    pcm = audio as Int16Array;
  } else if (fromCodec === 'mulaw') {
    pcm = mulawToPcm(audio as Buffer);
  } else {
    pcm = alawToPcm(audio as Buffer);
  }

  // Then convert from PCM to target
  if (toCodec === 'pcm') {
    return pcm;
  } else if (toCodec === 'mulaw') {
    return pcmToMulaw(pcm);
  } else {
    return pcmToAlaw(pcm);
  }
}
