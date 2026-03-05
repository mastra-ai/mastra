import type { Mastra } from '../mastra';
import type { Processor } from '../processors';
import type { ProcessorPhase } from './types';

/**
 * Wraps an existing Processor and only exposes the selected phases.
 * Unselected phase methods are left undefined, so the runner/step-creator skips them.
 */
export class PhaseFilteredProcessor<TId extends string = string, TTripwireMetadata = unknown> implements Processor<
  TId,
  TTripwireMetadata
> {
  readonly id: TId;
  readonly name?: string;
  readonly description?: string;
  processorIndex?: number;

  readonly #inner: Processor<TId, TTripwireMetadata>;
  readonly #enabledPhases: Set<ProcessorPhase>;

  constructor(inner: Processor<TId, TTripwireMetadata>, enabledPhases: ProcessorPhase[]) {
    this.#inner = inner;
    this.#enabledPhases = new Set(enabledPhases);
    this.id = inner.id;
    this.name = inner.name;
    this.description = inner.description;

    // Bind enabled phase methods to the inner processor
    if (this.#enabledPhases.has('processInput') && inner.processInput) {
      this.processInput = inner.processInput.bind(inner) as Processor<TId, TTripwireMetadata>['processInput'];
    }
    if (this.#enabledPhases.has('processInputStep') && inner.processInputStep) {
      this.processInputStep = inner.processInputStep.bind(inner) as Processor<
        TId,
        TTripwireMetadata
      >['processInputStep'];
    }
    if (this.#enabledPhases.has('processOutputStream') && inner.processOutputStream) {
      this.processOutputStream = inner.processOutputStream.bind(inner) as Processor<
        TId,
        TTripwireMetadata
      >['processOutputStream'];
    }
    if (this.#enabledPhases.has('processOutputResult') && inner.processOutputResult) {
      this.processOutputResult = inner.processOutputResult.bind(inner) as Processor<
        TId,
        TTripwireMetadata
      >['processOutputResult'];
    }
    if (this.#enabledPhases.has('processOutputStep') && inner.processOutputStep) {
      this.processOutputStep = inner.processOutputStep.bind(inner) as Processor<
        TId,
        TTripwireMetadata
      >['processOutputStep'];
    }
  }

  processInput?: Processor<TId, TTripwireMetadata>['processInput'];
  processInputStep?: Processor<TId, TTripwireMetadata>['processInputStep'];
  processOutputStream?: Processor<TId, TTripwireMetadata>['processOutputStream'];
  processOutputResult?: Processor<TId, TTripwireMetadata>['processOutputResult'];
  processOutputStep?: Processor<TId, TTripwireMetadata>['processOutputStep'];

  __registerMastra(mastra: Mastra<any, any, any, any, any, any, any, any, any, any>): void {
    this.#inner.__registerMastra?.(mastra);
  }
}
