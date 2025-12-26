export { BaseDatasetSource, type DatasetSource } from './dataset-source';
export { TracesSource, createTracesSource } from './traces-source';
export { ArraySource, createArraySource } from './array-source';
export { FileSource, createFileSource } from './file-source';

import type { MastraStorage } from '@mastra/core/storage';
import type { DatasetConfig } from '../types';
import { createArraySource } from './array-source';
import type { DatasetSource } from './dataset-source';
import { createFileSource } from './file-source';
import { createTracesSource } from './traces-source';

/**
 * Create a dataset source from configuration.
 */
export function createDatasetSource(config: DatasetConfig, storage?: MastraStorage): DatasetSource {
  switch (config.source) {
    case 'traces':
      if (!storage) {
        throw new Error('Storage is required for traces dataset source');
      }
      return createTracesSource(storage, config);

    case 'dataset':
      return createArraySource(config);

    case 'file':
      return createFileSource(config);

    default:
      throw new Error(`Unknown dataset source: ${(config as any).source}`);
  }
}
