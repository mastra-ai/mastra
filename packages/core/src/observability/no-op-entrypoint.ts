import type { Mastra } from '..';
import type { IMastraLogger } from '../logger';
import type { AISpan, AISpanType, GetOrCreateSpanOptions, ObservabilityEntrypoint } from './types';

export class NoOpEntrypoint implements ObservabilityEntrypoint {
  registerMastra(_options: { mastra: Mastra }): void {
    return;
  }

  setLogger(_options: { logger: IMastraLogger }): void {
    return;
  }

  getOrCreateSpan<T extends AISpanType>(_options: GetOrCreateSpanOptions<T>): AISpan<T> | undefined {
    return;
  }

  async shutdown(): Promise<void> {
    return;
  }
}
