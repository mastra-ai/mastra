import type { HarnessConfig } from './config';

export class Harness<TState = unknown> {
  readonly config: HarnessConfig<TState> | Record<string, unknown>;

  constructor();
  constructor(config: HarnessConfig<TState>);
  constructor(config: Record<string, unknown>);
  constructor(config: HarnessConfig<TState> | Record<string, unknown> = {}) {
    this.config = config;
  }
}
