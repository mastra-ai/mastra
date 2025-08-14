import {
  PromptInjectionDetector,
  type PromptInjectionOptions,
  type PromptInjectionResult,
  type PromptInjectionCategoryScores,
} from '../../../processors/processors/prompt-injection-detector';
import type { InputProcessor } from '../index';
import type { MastraMessageV2 } from '../../message-list';

/**
 * Backward-compatible wrapper for PromptInjectionDetector that implements the old InputProcessor interface
 */
export class PromptInjectionDetectorInputProcessor implements InputProcessor {
  readonly name = 'prompt-injection-detector';
  private processor: PromptInjectionDetector;

  constructor(options: PromptInjectionOptions) {
    this.processor = new PromptInjectionDetector(options);
  }

  async process(args: { messages: MastraMessageV2[]; abort: (reason?: string) => never }): Promise<MastraMessageV2[]> {
    return this.processor.processInput(args);
  }
}

export type { PromptInjectionOptions, PromptInjectionResult, PromptInjectionCategoryScores };
