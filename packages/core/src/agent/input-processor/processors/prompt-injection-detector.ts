import { PromptInjectionDetector } from '../../../processors/processors/prompt-injection-detector';
import type {
  PromptInjectionOptions,
  PromptInjectionResult,
  PromptInjectionCategoryScores,
} from '../../../processors/processors/prompt-injection-detector';
import type { MastraMessageV2 } from '../../message-list';
import type { InputProcessor } from '../index';

/**
 * Backward-compatible wrapper for PromptInjectionDetector that implements the old InputProcessor interface
 * @deprecated Use PromptInjectionDetector directly instead from @mastra/core/processors
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
