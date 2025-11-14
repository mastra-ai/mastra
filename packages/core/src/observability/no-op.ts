import type { Mastra } from '..';
import type { IMastraLogger } from '../logger';
import type { ObservabilityInstance, ConfigSelectorOptions, ObservabilityEntrypoint, ConfigSelector } from './types';

export class NoOpObservability implements ObservabilityEntrypoint {
  setMastraContext(_options: { mastra: Mastra }): void {
    return;
  }

  setLogger(_options: { logger: IMastraLogger }): void {
    return;
  }

  getSelectedInstance(_options: ConfigSelectorOptions): ObservabilityInstance | undefined {
    return;
  }

  registerInstance(_name: string, _instance: ObservabilityInstance, _isDefault = false): void {
    return;
  }

  getInstance(_name: string): ObservabilityInstance | undefined {
    return;
  }

  getDefaultInstance(): ObservabilityInstance | undefined {
    return;
  }

  listInstances(): ReadonlyMap<string, ObservabilityInstance> {
    return new Map();
  }

  unregisterInstance(_name: string): boolean {
    return false;
  }

  hasInstance(_name: string): boolean {
    return false;
  }

  setConfigSelector(_selector: ConfigSelector): void {
    return;
  }

  clear(): void {
    return;
  }

  async shutdown(): Promise<void> {
    return;
  }
}
