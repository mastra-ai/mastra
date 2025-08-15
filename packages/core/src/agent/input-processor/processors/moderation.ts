import { ModerationProcessor } from '../../../processors/processors/moderation';
import type {
  ModerationOptions,
  ModerationResult,
  ModerationCategoryScores,
} from '../../../processors/processors/moderation';
import type { MastraMessageV2 } from '../../message-list';
import type { InputProcessor } from '../index';

/**
 * Backward-compatible wrapper for ModerationProcessor that implements the old InputProcessor interface
 * @deprecated Use ModerationProcessor directly instead from @mastra/core/processors
 */
export class ModerationInputProcessor implements InputProcessor {
  readonly name = 'moderation';
  private processor: ModerationProcessor;

  constructor(options: ModerationOptions) {
    this.processor = new ModerationProcessor(options);
  }

  async process(args: { messages: MastraMessageV2[]; abort: (reason?: string) => never }): Promise<MastraMessageV2[]> {
    return this.processor.processInput(args);
  }
}

export type { ModerationOptions, ModerationResult, ModerationCategoryScores };
