import { generateId } from '@internal/ai-sdk-v5';
import {
  ToolLoopAgent,
  type AgentCallParameters,
  type ModelMessage,
  type StepResult,
  type ToolLoopAgentSettings,
} from '@internal/ai-v6';
import type { AgentExecutionOptions, AgentInstructions } from '../agent';
import type { ProcessInputStepArgs, ProcessInputStepResult, Processor } from '../processors';
import { resolveModelConfig } from '../llm/model/resolve-model';
import { isSupportedLanguageModel } from '../agent/utils';
import type { MastraLanguageModel } from '../llm/model/shared.types';
import type { OutputSchema } from '../stream';
import { getSettings as getToolLoopAgentSettings, type ToolLoopAgentLike } from './utils';

type PrepareCallInput = AgentCallParameters<never> &
  Pick<
    ToolLoopAgentSettings<never, any, any>,
    | 'model'
    | 'tools'
    | 'maxOutputTokens'
    | 'temperature'
    | 'topP'
    | 'topK'
    | 'presencePenalty'
    | 'frequencyPenalty'
    | 'stopSequences'
    | 'seed'
    | 'headers'
    | 'instructions'
    | 'stopWhen'
    | 'experimental_telemetry'
    | 'activeTools'
    | 'providerOptions'
    | 'experimental_context'
    | 'experimental_download'
  >;

export class ToolLoopAgentProcessor implements Processor<'tool-loop-to-mastra-agent'> {
  readonly id = 'tool-loop-to-mastra-agent';
  readonly name = 'ToolLoop to Mastra Agent Processor';

  private agent: ToolLoopAgentLike;
  private toolLoopAgentSettings: ToolLoopAgentSettings<any, any, any>;
  private prepareCallResult?: Awaited<ReturnType<NonNullable<ToolLoopAgentSettings<any, any, any>['prepareCall']>>>;

  constructor(agent: ToolLoopAgentLike) {
    this.agent = agent;
    this.toolLoopAgentSettings = getToolLoopAgentSettings(agent);
  }

  public getAgentConfig() {
    const tools = 'tools' in this.agent ? (this.agent as ToolLoopAgent).tools : undefined;

    // Build default options from ToolLoopAgent config params
    const defaultOptions: Omit<AgentExecutionOptions<OutputSchema>, 'abortSignal'> = {};

    // AgentExecutionOptions
    if (this.toolLoopAgentSettings.toolChoice) {
      defaultOptions.toolChoice = this.toolLoopAgentSettings.toolChoice;
    }
    if (this.toolLoopAgentSettings.providerOptions) {
      defaultOptions.providerOptions = this.toolLoopAgentSettings.providerOptions;
    }
    // AgentExecutionOptions["modelSettings"]
    if (this.toolLoopAgentSettings.temperature !== undefined) {
      defaultOptions.modelSettings = {
        ...(defaultOptions.modelSettings ?? {}),
        temperature: this.toolLoopAgentSettings.temperature,
      };
    }
    if (this.toolLoopAgentSettings.topP !== undefined) {
      defaultOptions.modelSettings = { ...(defaultOptions.modelSettings ?? {}), topP: this.toolLoopAgentSettings.topP };
    }
    if (this.toolLoopAgentSettings.topK !== undefined) {
      defaultOptions.modelSettings = { ...(defaultOptions.modelSettings ?? {}), topK: this.toolLoopAgentSettings.topK };
    }
    if (this.toolLoopAgentSettings.seed !== undefined) {
      defaultOptions.modelSettings = { ...(defaultOptions.modelSettings ?? {}), seed: this.toolLoopAgentSettings.seed };
    }
    if (this.toolLoopAgentSettings.maxOutputTokens !== undefined) {
      defaultOptions.modelSettings = {
        ...(defaultOptions.modelSettings ?? {}),
        maxOutputTokens: this.toolLoopAgentSettings.maxOutputTokens,
      };
    }

    // TODO: what is presencePenalty
    // if (this.settings.presencePenalty !== undefined) {
    //   defaultOptions.presencePenalty = this.settings.presencePenalty;
    // }
    // TODO: what is frequencyPenalty
    // if (this.settings.frequencyPenalty !== undefined) {
    //   defaultOptions.frequencyPenalty = this.settings.frequencyPenalty;
    // }
    // TODO: what is stopSequences
    // if (this.settings.stopSequences !== undefined) {
    //   defaultOptions.stopSequences = this.settings.stopSequences;
    // }

    if (this.toolLoopAgentSettings.onStepFinish) {
      // TODO: whats different about our onStepFinish vs ToolLoopAgent's?
      // @ts-expect-error
      defaultOptions.onStepFinish = this.toolLoopAgentSettings.onStepFinish;
    }
    if (this.toolLoopAgentSettings.onFinish) {
      // TODO: whats different about our onFinish vs ToolLoopAgent's?
      // @ts-expect-error
      defaultOptions.onFinish = this.toolLoopAgentSettings.onFinish;
    }

    const id = this.toolLoopAgentSettings.id ?? `tool-loop-agent-${generateId()}`;
    return {
      id,
      name: id,
      instructions: (this.toolLoopAgentSettings.instructions as AgentInstructions) ?? '',
      model: this.toolLoopAgentSettings.model,
      tools,
      maxRetries: this.toolLoopAgentSettings.maxRetries,
      defaultOptions: Object.keys(defaultOptions).length > 0 ? defaultOptions : undefined,
    };
  }

  private toolLoopAgentCallParamsToMastraAgentExecutionOptions(params: PrepareCallInput) {
    const {
      model,
      tools,
      instructions,
      stopWhen,
      activeTools,
      providerOptions,

      temperature,
      topP,
      topK,
      maxOutputTokens,
      presencePenalty,
      frequencyPenalty,
      stopSequences,
      seed,

      //   experimental_telemetry,
      //   experimental_context,
      //   experimental_download,
    } = params;

    const modelSettings = {
      temperature,
      topP,
      topK,
      maxOutputTokens,
      presencePenalty,
      frequencyPenalty,
      stopSequences,
      seed,
    };

    const options: AgentExecutionOptions<any> = {
      providerOptions,
    };

    if (Object.entries(modelSettings).map(([_, value]) => value !== undefined).length > 0) {
      options.modelSettings = modelSettings;
    }

    return options;
  }

  private async handlePrepareCall(args: ProcessInputStepArgs) {
    if (this.toolLoopAgentSettings.prepareCall) {
      const { model, messages, activeTools, providerOptions, modelSettings, tools, messageList } = args;
      // TODO: This should probably happen in processInput, currently calling in processInputStep if stepNumber === 0

      // Build the prepareCall input object
      // AI SDK prepareCall expects: AgentCallParameters & Pick<ToolLoopAgentSettings, ...settings>
      const prepareCallInput: PrepareCallInput = {
        // TODO: prepareCall expects messages in AI SDK format, we have them in Mastra format
        messages: messages as unknown as any,
        model,
        tools,
        instructions: this.toolLoopAgentSettings.instructions,
        stopWhen: this.toolLoopAgentSettings.stopWhen,
        activeTools,
        providerOptions,

        // Model settings
        temperature: modelSettings?.temperature,
        topP: modelSettings?.topP,
        topK: modelSettings?.topK,
        maxOutputTokens: modelSettings?.maxOutputTokens,
        presencePenalty: modelSettings?.presencePenalty,
        frequencyPenalty: modelSettings?.frequencyPenalty,
        stopSequences: modelSettings?.stopSequences,
        seed: modelSettings?.seed,

        // Experimental options
        // experimental_telemetry: this.settings.experimental_telemetry,
        // experimental_context: this.settings.experimental_context,
        // experimental_download: this.settings.experimental_download,
      };

      // Call prepareCall and apply any returned overrides
      const prepareCallResult = await this.toolLoopAgentSettings.prepareCall(prepareCallInput as any); // TODO: types
      console.log('prepareCallResult', prepareCallResult);
      this.prepareCallResult = prepareCallResult;
    }
  }

  private async handleStopWhen(args: ProcessInputStepArgs) {
    const { steps, abort } = args;
    if (this.toolLoopAgentSettings.stopWhen !== undefined) {
      if (Array.isArray(this.toolLoopAgentSettings.stopWhen)) {
        for (const condition of this.toolLoopAgentSettings.stopWhen) {
          // TODO: Different StepResult type
          const shouldStop = await condition({ steps: steps as StepResult<any>[] });
          if (shouldStop) {
            abort('stopWhen condition met');
          }
        }
      } else if (typeof this.toolLoopAgentSettings.stopWhen === 'function') {
        // TODO: Different StepResult type
        const shouldStop = await this.toolLoopAgentSettings.stopWhen({ steps: steps as StepResult<any>[] });
        if (shouldStop) {
          abort('stopWhen condition met');
        }
      }
    }
  }

  private async handlePrepareStep(args: ProcessInputStepArgs) {
    if (this.toolLoopAgentSettings.prepareStep) {
      const { model, messages, steps, stepNumber } = args;

      // TODO: Map ToolLoopAgent prepareStep to Mastra processInputStep
      const prepareStepInputArgs: {
        /**
         * The steps that have been executed so far.
         */
        steps: Array<StepResult<NoInfer<any>>>;
        /**
         * The number of the step that is being executed.
         */
        stepNumber: number;
        /**
         * The model instance that is being used for this step.
         */
        model: MastraLanguageModel;
        /**
         * The messages that will be sent to the model for the current step.
         */
        messages: Array<ModelMessage>;
        /**
         * The context passed via the experimental_context setting (experimental).
         */
        experimental_context: unknown;
      } = {
        model: model,
        // TODO: messages are in Mastra format but ToolLoopAgent prepareStep expects AI SDK format
        messages: messages as any,
        // TODO: Types of property usage are incompatible.
        // Type `usage` is missing the following properties from type:
        // - inputTokenDetails
        // - outputTokenDetails
        steps: steps as any,
        stepNumber,
        experimental_context: undefined,
      };

      const prepareStepResult = await this.toolLoopAgentSettings.prepareStep(prepareStepInputArgs);
      return prepareStepResult;
    }
  }

  async processInputStep(args: ProcessInputStepArgs): Promise<ProcessInputStepResult | undefined | void> {
    const { stepNumber } = args;

    if (this.toolLoopAgentSettings.stopWhen !== undefined) {
      await this.handleStopWhen(args);
    }

    if (stepNumber === 0 && this.toolLoopAgentSettings.prepareCall) {
      await this.handlePrepareCall(args);
    }

    let result: ProcessInputStepResult = {};

    if (this.prepareCallResult) {
      // TODO: Map prepareCall result to processInputStep result
      // ... add some stuff to result
      result = {
        ...result,
        // tools: this.prepareCallResult.tools,
        // model: this.prepareCallResult.model,
      };
    }

    if (this.toolLoopAgentSettings.prepareStep) {
      const prepareStepResult = await this.handlePrepareStep(args);
      console.log('prepareStepResult', prepareStepResult);
      if (prepareStepResult) {
        // TODO: Map prepareStep result to processInputStep result
        // ... add some stuff to result
      }
    }

    return result;
  }
}
