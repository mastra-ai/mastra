/**
 * Type declarations for alawmulaw package
 * @see https://github.com/rochars/alawmulaw
 */
declare module 'alawmulaw' {
  /**
   * μ-law (mu-law) codec for ITU-T G.711
   */
  export const mulaw: {
    /**
     * Encode 16-bit PCM samples to 8-bit μ-law
     * @param samples - Int16Array of PCM samples
     * @returns Uint8Array of μ-law encoded samples
     */
    encode(samples: Int16Array): Uint8Array;

    /**
     * Decode 8-bit μ-law samples to 16-bit PCM
     * @param samples - Uint8Array of μ-law samples
     * @returns Int16Array of PCM samples
     */
    decode(samples: Uint8Array): Int16Array;
  };

  /**
   * A-law codec for ITU-T G.711
   */
  export const alaw: {
    /**
     * Encode 16-bit PCM samples to 8-bit A-law
     * @param samples - Int16Array of PCM samples
     * @returns Uint8Array of A-law encoded samples
     */
    encode(samples: Int16Array): Uint8Array;

    /**
     * Decode 8-bit A-law samples to 16-bit PCM
     * @param samples - Uint8Array of A-law samples
     * @returns Int16Array of PCM samples
     */
    decode(samples: Uint8Array): Int16Array;
  };
}
