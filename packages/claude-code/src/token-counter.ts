import { Tiktoken } from 'js-tiktoken/lite';
import type { TiktokenBPE } from 'js-tiktoken/lite';
import o200k_base from 'js-tiktoken/ranks/o200k_base';

/**
 * Token counting utility using tiktoken (o200k_base encoding).
 * Adapted from @mastra/memory's TokenCounter for standalone use.
 */
export class TokenCounter {
  private encoder: Tiktoken;

  constructor(encoding?: TiktokenBPE) {
    this.encoder = new Tiktoken(encoding || o200k_base);
  }

  /**
   * Count tokens in a plain string.
   */
  count(text: string): number {
    if (!text) return 0;
    return this.encoder.encode(text, 'all').length;
  }
}
