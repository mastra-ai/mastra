import { PromptInjectionDetector } from '../../../processors/processors/prompt-injection-detector';
import type {
  PromptInjectionOptions,
  PromptInjectionResult,
  PromptInjectionCategoryScores,
} from '../../../processors/processors/prompt-injection-detector';
import type { MastraDBMessage } from '../../message-list';
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

  async process(args: { messages: MastraDBMessage[]; abort: (reason?: string) => never }): Promise<MastraDBMessage[]> {
    return this.processor.processInput(args);
  }
}

export type { PromptInjectionOptions, PromptInjectionResult, PromptInjectionCategoryScores };
