import type { MastraLanguageModel } from '../../llm/model/shared.types';
import type { RunProcessInputStepResult } from '../../processors';

/**
 * Shape of the per-step LLM input fields that an input-processor (or
 * `prepareStep`) is allowed to override.
 */
export interface StepInputFields {
  messageId: string;
  model: MastraLanguageModel;
  tools?: any;
  toolChoice?: any;
  activeTools?: string[] | undefined;
  providerOptions?: any;
  modelSettings?: any;
  structuredOutput?: any;
}

/**
 * Merge an input-step processor result back into the current step. Mirrors
 * the regular agentic-execution step's `Object.assign(currentStep, ...)`
 * semantics so the durable and non-durable paths apply `prepareStep` and
 * other input processors identically.
 *
 * Fields that the runner did not touch are preserved verbatim; fields the
 * runner did touch fully replace the current value. `modelSettings` is
 * intentionally replaced rather than shallow-merged — that matches the
 * non-durable path and matches the contract documented on processor
 * results, where the returned `modelSettings` is the final shape for this
 * step.
 */
export function composeStepInput(
  current: StepInputFields,
  processInputStepResult: RunProcessInputStepResult | undefined,
): StepInputFields {
  if (!processInputStepResult) {
    return current;
  }
  // The runner always returns a fully-populated stepInput (initialized from
  // the caller's args). `??` would behave identically here; we use plain
  // assignment to preserve full replacement semantics for any field a
  // processor set explicitly to a falsy-but-defined value.
  return {
    messageId: processInputStepResult.messageId ?? current.messageId,
    model: (processInputStepResult.model ?? current.model) as MastraLanguageModel,
    tools: 'tools' in processInputStepResult ? processInputStepResult.tools : current.tools,
    toolChoice: 'toolChoice' in processInputStepResult ? processInputStepResult.toolChoice : current.toolChoice,
    activeTools:
      'activeTools' in processInputStepResult ? processInputStepResult.activeTools : current.activeTools,
    providerOptions:
      'providerOptions' in processInputStepResult ? processInputStepResult.providerOptions : current.providerOptions,
    modelSettings:
      'modelSettings' in processInputStepResult ? processInputStepResult.modelSettings : current.modelSettings,
    structuredOutput:
      'structuredOutput' in processInputStepResult
        ? processInputStepResult.structuredOutput
        : current.structuredOutput,
  };
}
