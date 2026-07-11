import { SignalProvider } from '@mastra/core/signals';

import type { NormalizedBehaviorDefinition } from '../definition/types.js';
import { BehaviorStateProcessor } from './state-processor.js';
import { BehaviorTransitionEngine, type BehaviorTransitionEngineOptions } from './transition-engine.js';
import type { BehaviorRuntimeStore } from './types.js';

export type BehaviorSignalProviderOptions = Omit<BehaviorTransitionEngineOptions, 'definition' | 'store'> & {
  definition: NormalizedBehaviorDefinition;
  store: BehaviorRuntimeStore;
};

export class BehaviorSignalProvider extends SignalProvider<string> {
  readonly id: string;
  readonly engine: BehaviorTransitionEngine;
  private readonly stateProcessor: BehaviorStateProcessor;

  constructor(readonly options: BehaviorSignalProviderOptions) {
    super();
    this.id = `behavior-${options.definition.id}`;
    this.engine = new BehaviorTransitionEngine(options);
    this.stateProcessor = new BehaviorStateProcessor(options.definition, options.store);
  }

  async start(): Promise<void> {
    await this.options.store.init();
  }

  getInputProcessors() {
    return [this.stateProcessor];
  }
}
