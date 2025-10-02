import { removeAllOptionsFromMastraExcept } from './remove-all-options-except';
import type { IMastraLogger } from '@mastra/core/logger';

export function removeAllOptionsExceptServer(result: { hasCustomConfig: boolean }, logger?: IMastraLogger) {
  return removeAllOptionsFromMastraExcept(result, 'server', logger);
}
