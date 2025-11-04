import type { Mastra } from '..';
import type { IMastraLogger } from '../logger';
import type { AITracing, ConfigSelectorOptions, ObservabilityEntrypoint } from './types';

export class NoOpEntrypoint implements ObservabilityEntrypoint {
  getSelectedObservability(_options: ConfigSelectorOptions): AITracing | undefined {
    return;
  }

  registerMastra(_options: { mastra: Mastra }): void {
    return;
  }

  setLogger(_options: { logger: IMastraLogger }): void {
    return;
  }

  async shutdown(): Promise<void> {
    return;
  }
}
