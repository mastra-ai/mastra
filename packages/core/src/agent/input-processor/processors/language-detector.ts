import { LanguageDetector } from '../../../processors/processors/language-detector';
import type {
  LanguageDetectorOptions,
  LanguageDetectionResult,
  LanguageDetection,
  TranslationResult,
} from '../../../processors/processors/language-detector';
import type { MastraMessageV2 } from '../../message-list';
import type { InputProcessor } from '../index';

/**
 * Backward-compatible wrapper for LanguageDetector that implements the old InputProcessor interface
 * @deprecated Use LanguageDetector directly instead from @mastra/core/processors
 */
export class LanguageDetectorInputProcessor implements InputProcessor {
  readonly name = 'language-detector';
  private processor: LanguageDetector;

  constructor(options: LanguageDetectorOptions) {
    this.processor = new LanguageDetector(options);
  }

  async process(args: { messages: MastraMessageV2[]; abort: (reason?: string) => never }): Promise<MastraMessageV2[]> {
    return this.processor.processInput(args);
  }
}

export type { LanguageDetectorOptions, LanguageDetectionResult, LanguageDetection, TranslationResult };
