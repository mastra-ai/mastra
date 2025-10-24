import { UnicodeNormalizer } from '../../../processors/processors/unicode-normalizer';
import type { UnicodeNormalizerOptions } from '../../../processors/processors/unicode-normalizer';
import type { MastraDBMessage } from '../../message-list';
import type { InputProcessor } from '../index';

/**
 * Backward-compatible wrapper for UnicodeNormalizer that implements the old InputProcessor interface
 * @deprecated Use UnicodeNormalizer directly instead from @mastra/core/processors
 */
export class UnicodeNormalizerInputProcessor implements InputProcessor {
  readonly name = 'unicode-normalizer';
  private processor: UnicodeNormalizer;

  constructor(options: UnicodeNormalizerOptions = {}) {
    this.processor = new UnicodeNormalizer(options);
  }

  process(args: {
    messages: MastraDBMessage[];
    abort: (reason?: string) => never;
  }): Promise<MastraDBMessage[]> | MastraDBMessage[] {
    return this.processor.processInput(args);
  }
}

export type { UnicodeNormalizerOptions };
