import { PIIDetector } from '../../../processors/processors/pii-detector';
import type {
  PIIDetectorOptions,
  PIIDetectionResult,
  PIICategories,
  PIICategoryScores,
  PIIDetection,
} from '../../../processors/processors/pii-detector';
import type { MastraMessageV2 } from '../../message-list';
import type { InputProcessor } from '../index';

/**
 * Backward-compatible wrapper for PIIDetector that implements the old InputProcessor interface
 * @deprecated Use PIIDetector directly instead from @mastra/core/processors
 */
export class PIIDetectorInputProcessor implements InputProcessor {
  readonly name = 'pii-detector';
  private processor: PIIDetector;

  constructor(options: PIIDetectorOptions) {
    this.processor = new PIIDetector(options);
  }

  async process(args: { messages: MastraMessageV2[]; abort: (reason?: string) => never }): Promise<MastraMessageV2[]> {
    return this.processor.processInput(args);
  }
}

export type { PIIDetectorOptions, PIIDetectionResult, PIICategories, PIICategoryScores, PIIDetection };
