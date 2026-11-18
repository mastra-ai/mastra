import type { OutputProcessorOrWorkflow } from '../processors';
import { isProcessorWorkflow } from '../processors/is-processor-workflow';
import { normalizeMessageHistoryConfig } from './message-history-config';
import { isObservationalMemoryEnabled } from './types';
import type { MemoryConfigInternal } from './types';

export function memoryTurnSaver(
  config: MemoryConfigInternal,
  configuredProcessors: OutputProcessorOrWorkflow[],
): 'message-history' | 'observational-memory' | undefined {
  const configuresOwnSaver = configuredProcessors.some(
    p => !isProcessorWorkflow(p) && (p.id === 'message-history' || p.id === 'observational-memory'),
  );
  if (configuresOwnSaver) return;
  if (isObservationalMemoryEnabled(config.observationalMemory)) return 'observational-memory';
  if (normalizeMessageHistoryConfig(config.lastMessages, config.messageHistory).enabled) return 'message-history';
}
