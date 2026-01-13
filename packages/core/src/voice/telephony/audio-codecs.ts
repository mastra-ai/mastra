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
 * This module provides conversion utilities between these formats.
 */

// μ-law decoding table (8-bit mulaw → 16-bit PCM)
const MULAW_DECODE_TABLE = new Int16Array([
  -32124, -31100, -30076, -29052, -28028, -27004, -25980, -24956, -23932, -22908, -21884, -20860, -19836, -18812,
  -17788, -16764, -15996, -15484, -14972, -14460, -13948, -13436, -12924, -12412, -11900, -11388, -10876, -10364, -9852,
  -9340, -8828, -8316, -7932, -7676, -7420, -7164, -6908, -6652, -6396, -6140, -5884, -5628, -5372, -5116, -4860, -4604,
  -4348, -4092, -3900, -3772, -3644, -3516, -3388, -3260, -3132, -3004, -2876, -2748, -2620, -2492, -2364, -2236, -2108,
  -1980, -1884, -1820, -1756, -1692, -1628, -1564, -1500, -1436, -1372, -1308, -1244, -1180, -1116, -1052, -988, -924,
  -876, -844, -812, -780, -748, -716, -684, -652, -620, -588, -556, -524, -492, -460, -428, -396, -372, -356, -340,
  -324, -308, -292, -276, -260, -244, -228, -212, -196, -180, -164, -148, -132, -120, -112, -104, -96, -88, -80, -72,
  -64, -56, -48, -40, -32, -24, -16, -8, 0, 32124, 31100, 30076, 29052, 28028, 27004, 25980, 24956, 23932, 22908, 21884,
  20860, 19836, 18812, 17788, 16764, 15996, 15484, 14972, 14460, 13948, 13436, 12924, 12412, 11900, 11388, 10876, 10364,
  9852, 9340, 8828, 8316, 7932, 7676, 7420, 7164, 6908, 6652, 6396, 6140, 5884, 5628, 5372, 5116, 4860, 4604, 4348,
  4092, 3900, 3772, 3644, 3516, 3388, 3260, 3132, 3004, 2876, 2748, 2620, 2492, 2364, 2236, 2108, 1980, 1884, 1820,
  1756, 1692, 1628, 1564, 1500, 1436, 1372, 1308, 1244, 1180, 1116, 1052, 988, 924, 876, 844, 812, 780, 748, 716, 684,
  652, 620, 588, 556, 524, 492, 460, 428, 396, 372, 356, 340, 324, 308, 292, 276, 260, 244, 228, 212, 196, 180, 164,
  148, 132, 120, 112, 104, 96, 88, 80, 72, 64, 56, 48, 40, 32, 24, 16, 8, 0,
]);

// A-law decoding table
const ALAW_DECODE_TABLE = new Int16Array([
  -5504, -5248, -6016, -5760, -4480, -4224, -4992, -4736, -7552, -7296, -8064, -7808, -6528, -6272, -7040, -6784, -2752,
  -2624, -3008, -2880, -2240, -2112, -2496, -2368, -3776, -3648, -4032, -3904, -3264, -3136, -3520, -3392, -22016,
  -20992, -24064, -23040, -17920, -16896, -19968, -18944, -30208, -29184, -32256, -31232, -26112, -25088, -28160,
  -27136, -11008, -10496, -12032, -11520, -8960, -8448, -9984, -9472, -15104, -14592, -16128, -15616, -13056, -12544,
  -14080, -13568, -344, -328, -376, -360, -280, -264, -312, -296, -472, -456, -504, -488, -408, -392, -440, -424, -88,
  -72, -120, -104, -24, -8, -56, -40, -216, -200, -248, -232, -152, -136, -184, -168, -1376, -1312, -1504, -1440, -1120,
  -1056, -1248, -1184, -1888, -1824, -2016, -1952, -1632, -1568, -1760, -1696, -688, -656, -752, -720, -560, -528, -624,
  -592, -944, -912, -1008, -976, -816, -784, -880, -848, 5504, 5248, 6016, 5760, 4480, 4224, 4992, 4736, 7552, 7296,
  8064, 7808, 6528, 6272, 7040, 6784, 2752, 2624, 3008, 2880, 2240, 2112, 2496, 2368, 3776, 3648, 4032, 3904, 3264,
  3136, 3520, 3392, 22016, 20992, 24064, 23040, 17920, 16896, 19968, 18944, 30208, 29184, 32256, 31232, 26112, 25088,
  28160, 27136, 11008, 10496, 12032, 11520, 8960, 8448, 9984, 9472, 15104, 14592, 16128, 15616, 13056, 12544, 14080,
  13568, 344, 328, 376, 360, 280, 264, 312, 296, 472, 456, 504, 488, 408, 392, 440, 424, 88, 72, 120, 104, 24, 8, 56,
  40, 216, 200, 248, 232, 152, 136, 184, 168, 1376, 1312, 1504, 1440, 1120, 1056, 1248, 1184, 1888, 1824, 2016, 1952,
  1632, 1568, 1760, 1696, 688, 656, 752, 720, 560, 528, 624, 592, 944, 912, 1008, 976, 816, 784, 880, 848,
]);

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
  const pcm = new Int16Array(mulawBuffer.length);
  for (let i = 0; i < mulawBuffer.length; i++) {
    pcm[i] = MULAW_DECODE_TABLE[mulawBuffer[i]!]!;
  }
  return pcm;
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
  const mulaw = Buffer.alloc(pcm.length);

  for (let i = 0; i < pcm.length; i++) {
    let sample = pcm[i]!;

    // Get the sign bit
    const sign = sample < 0 ? 0x80 : 0;
    if (sign) sample = -sample;

    // Clip to 32635 (max value for mulaw)
    if (sample > 32635) sample = 32635;

    // Add bias
    sample += 0x84;

    // Find the segment
    let segment = 7;
    for (let seg = 0; seg < 8; seg++) {
      if (sample < 1 << (seg + 8)) {
        segment = seg;
        break;
      }
    }

    // Combine sign, segment, and quantized sample
    const mantissa = (sample >> (segment + 3)) & 0x0f;
    mulaw[i] = ~(sign | (segment << 4) | mantissa) & 0xff;
  }

  return mulaw;
}

/**
 * Convert A-law encoded audio to 16-bit PCM
 *
 * @param alawBuffer - Buffer containing A-law encoded audio (8-bit, 8kHz)
 * @returns Int16Array containing PCM audio (16-bit signed)
 */
export function alawToPcm(alawBuffer: Buffer): Int16Array {
  const pcm = new Int16Array(alawBuffer.length);
  for (let i = 0; i < alawBuffer.length; i++) {
    pcm[i] = ALAW_DECODE_TABLE[alawBuffer[i]!]!;
  }
  return pcm;
}

/**
 * Convert 16-bit PCM audio to A-law encoding
 *
 * @param pcm - Int16Array containing PCM audio (16-bit signed)
 * @returns Buffer containing A-law encoded audio (8-bit)
 */
export function pcmToAlaw(pcm: Int16Array): Buffer {
  const alaw = Buffer.alloc(pcm.length);

  for (let i = 0; i < pcm.length; i++) {
    let sample = pcm[i]!;

    // Get sign
    const sign = sample < 0 ? 0x80 : 0;
    if (sign) sample = -sample;

    // Compress
    let companded: number;
    if (sample >= 256) {
      let segment = 7;
      for (let seg = 1; seg < 8; seg++) {
        if (sample < 1 << (seg + 8)) {
          segment = seg;
          break;
        }
      }
      const mantissa = (sample >> (segment + 3)) & 0x0f;
      companded = (segment << 4) | mantissa;
    } else {
      companded = sample >> 4;
    }

    alaw[i] = (companded ^ sign ^ 0x55) & 0xff;
  }

  return alaw;
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
