import { EmbedResult, EmbedManyResult } from 'ai';

/**
 * Base class for all embedder implementations
 */
export abstract class MastraEmbedder {
  constructor() {}

  /**
   * Embed a single text string into a vector
   * @param value The text to embed
   * @param options Options for the embedding process
   * @returns Promise<EmbedResult<string>> The embedding result
   */
  abstract embed(value: string, options?: { maxRetries?: number }): Promise<EmbedResult<string>>;

  /**
   * Embed multiple text strings into vectors
   * @param values Array of text strings to embed
   * @param options Options for the embedding process
   * @returns Promise<EmbedManyResult<string>> Array of embedding results
   */
  abstract embedMany(values: string[], options?: { maxRetries?: number }): Promise<EmbedManyResult<string>>;
}
