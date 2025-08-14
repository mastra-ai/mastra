import {
  LanguageDetector,
  type LanguageDetectorOptions,
  type LanguageDetectionResult,
  type LanguageDetection,
  type TranslationResult,
} from '../../../processors/processors/language-detector';
import type { InputProcessor } from '../index';
import type { MastraMessageV2 } from '../../message-list';

/**
 * Backward-compatible wrapper for LanguageDetector that implements the old InputProcessor interface
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
