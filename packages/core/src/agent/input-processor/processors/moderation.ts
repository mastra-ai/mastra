import {
  ModerationProcessor,
  type ModerationOptions,
  type ModerationResult,
  type ModerationCategoryScores,
} from '../../../processors/processors/moderation';
import type { InputProcessor } from '../index';
import type { MastraMessageV2 } from '../../message-list';

/**
 * Backward-compatible wrapper for ModerationProcessor that implements the old InputProcessor interface
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
