import type {
  ToolLoopAgent,
  AgentCallParameters,
  ModelMessage,
  StepResult,
  ToolLoopAgentSettings,
} from '@internal/ai-v6';
import type { AgentExecutionOptions, AgentInstructions } from '../agent';
import type { MastraLanguageModel } from '../llm/model/shared.types';
import type { ProcessInputStepArgs, ProcessInputStepResult, Processor } from '../processors';
import type { OutputSchema } from '../stream';
import { getSettings as getToolLoopAgentSettings } from './utils';
import type { ToolLoopAgentLike } from './utils';

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
  private settings: ToolLoopAgentSettings<any, any, any>;
  private prepareCallResult?: Awaited<ReturnType<NonNullable<ToolLoopAgentSettings<any, any, any>['prepareCall']>>>;

  constructor(agent: ToolLoopAgentLike) {
    this.agent = agent;
    this.settings = getToolLoopAgentSettings(agent);
  }

  public getAgentConfig() {
    const tools = 'tools' in this.agent ? (this.agent as ToolLoopAgent).tools : undefined;

    // Build default options from ToolLoopAgent config params
    const defaultOptions: Omit<AgentExecutionOptions<OutputSchema>, 'abortSignal'> = {};

    // AgentExecutionOptions
    if (this.settings.toolChoice) {
      defaultOptions.toolChoice = this.settings.toolChoice;
    }
    if (this.settings.providerOptions) {
      defaultOptions.providerOptions = this.settings.providerOptions;
    }
    // AgentExecutionOptions["modelSettings"]
    if (this.settings.temperature !== undefined) {
      defaultOptions.modelSettings = {
        ...(defaultOptions.modelSettings ?? {}),
        temperature: this.settings.temperature,
      };
    }
    if (this.settings.topP !== undefined) {
      defaultOptions.modelSettings = { ...(defaultOptions.modelSettings ?? {}), topP: this.settings.topP };
    }
    if (this.settings.topK !== undefined) {
      defaultOptions.modelSettings = { ...(defaultOptions.modelSettings ?? {}), topK: this.settings.topK };
    }
    if (this.settings.seed !== undefined) {
      defaultOptions.modelSettings = { ...(defaultOptions.modelSettings ?? {}), seed: this.settings.seed };
    }
    if (this.settings.maxOutputTokens !== undefined) {
      defaultOptions.modelSettings = {
        ...(defaultOptions.modelSettings ?? {}),
        maxOutputTokens: this.settings.maxOutputTokens,
      };
    }
    if (this.settings.presencePenalty !== undefined) {
      defaultOptions.modelSettings = {
        ...(defaultOptions.modelSettings ?? {}),
        presencePenalty: this.settings.presencePenalty,
      };
    }
    if (this.settings.frequencyPenalty !== undefined) {
      defaultOptions.modelSettings = {
        ...(defaultOptions.modelSettings ?? {}),
        frequencyPenalty: this.settings.frequencyPenalty,
      };
    }
    if (this.settings.stopSequences !== undefined) {
      defaultOptions.modelSettings = {
        ...(defaultOptions.modelSettings ?? {}),
        stopSequences: this.settings.stopSequences,
      };
    }

    if (this.settings.onStepFinish) {
      // TODO: The callback signatures differ (ReasoningChunk vs ReasoningPart) - need adapter
      defaultOptions.onStepFinish = this.settings.onStepFinish as unknown as typeof defaultOptions.onStepFinish;
    }
    if (this.settings.onFinish) {
      // TODO: The callback signatures differ (ReasoningChunk vs ReasoningPart) - need adapter
      defaultOptions.onFinish = this.settings.onFinish as unknown as typeof defaultOptions.onFinish;
    }

    return {
      id: this.settings.id,
      name: this.settings.id,
      instructions: (this.settings.instructions as AgentInstructions) ?? '',
      model: this.settings.model,
      tools,
      maxRetries: this.settings.maxRetries,
      defaultOptions: Object.keys(defaultOptions).length > 0 ? defaultOptions : undefined,
    };
  }

  /**
   * Maps prepareCall or prepareStep result to ProcessInputStepResult.
   * Both hooks return similar structures that can override model, tools, activeTools, etc.
   */
  private mapToProcessInputStepResult(
    result: Awaited<ReturnType<NonNullable<ToolLoopAgentSettings<any, any, any>['prepareCall']>>> | undefined,
  ): ProcessInputStepResult {
    if (!result) {
      return {};
    }

    const stepResult: ProcessInputStepResult = {};

    // Map model (both prepareCall and prepareStep can return this)
    if (result.model) {
      stepResult.model = result.model;
    }

    // Map tools (prepareCall can return this)
    if ('tools' in result && result.tools) {
      stepResult.tools = result.tools as Record<string, unknown>;
    }

    // Map toolChoice (prepareStep can return this)
    if ('toolChoice' in result && result.toolChoice !== undefined) {
      stepResult.toolChoice = result.toolChoice as ProcessInputStepResult['toolChoice'];
    }

    // Map activeTools (both can return this)
    if (result.activeTools) {
      stepResult.activeTools = result.activeTools as string[];
    }

    // Map providerOptions (prepareCall can return this)
    if ('providerOptions' in result && result.providerOptions) {
      stepResult.providerOptions = result.providerOptions;
    }

    // Map model settings (prepareCall can return individual settings)
    const modelSettings: ProcessInputStepResult['modelSettings'] = {};
    if ('temperature' in result && result.temperature !== undefined) {
      modelSettings.temperature = result.temperature;
    }
    if ('topP' in result && result.topP !== undefined) {
      modelSettings.topP = result.topP;
    }
    if ('topK' in result && result.topK !== undefined) {
      modelSettings.topK = result.topK;
    }
    if ('maxOutputTokens' in result && result.maxOutputTokens !== undefined) {
      modelSettings.maxOutputTokens = result.maxOutputTokens;
    }
    if ('presencePenalty' in result && result.presencePenalty !== undefined) {
      modelSettings.presencePenalty = result.presencePenalty;
    }
    if ('frequencyPenalty' in result && result.frequencyPenalty !== undefined) {
      modelSettings.frequencyPenalty = result.frequencyPenalty;
    }
    if ('stopSequences' in result && result.stopSequences !== undefined) {
      modelSettings.stopSequences = result.stopSequences;
    }
    if ('seed' in result && result.seed !== undefined) {
      modelSettings.seed = result.seed;
    }

    if (Object.keys(modelSettings).length > 0) {
      stepResult.modelSettings = modelSettings;
    }

    // Map system/instructions to systemMessages
    // prepareCall returns 'instructions', prepareStep returns 'system'
    const systemContent =
      'instructions' in result ? result.instructions : 'system' in result ? result.system : undefined;
    if (systemContent) {
      // Convert to CoreMessageV4 format
      if (typeof systemContent === 'string') {
        stepResult.systemMessages = [{ role: 'system', content: systemContent }];
      } else if (Array.isArray(systemContent)) {
        stepResult.systemMessages = systemContent.map(msg =>
          typeof msg === 'string' ? { role: 'system' as const, content: msg } : msg,
        );
      } else if (typeof systemContent === 'object' && 'role' in systemContent && 'content' in systemContent) {
        stepResult.systemMessages = [systemContent as { role: 'system'; content: string }];
      }
    }

    // TODO: Map messages if prepareStep returns them
    // This requires converting AI SDK ModelMessage[] to MastraDBMessage[]
    // if ('messages' in result && result.messages) {
    //   stepResult.messages = convertAiSdkMessagesToMastra(result.messages);
    // }

    return stepResult;
  }

  private async handlePrepareCall(args: ProcessInputStepArgs) {
    if (this.settings.prepareCall) {
      const { model, messages, activeTools, providerOptions, modelSettings, tools, messageList } = args;
      // TODO: This should probably happen in processInput, currently calling in processInputStep if stepNumber === 0

      // Build the prepareCall input object
      // AI SDK prepareCall expects: AgentCallParameters & Pick<ToolLoopAgentSettings, ...settings>
      const prepareCallInput: PrepareCallInput = {
        // TODO: prepareCall expects messages in AI SDK format, we have them in Mastra format
        messages: messages as unknown as any,
        model,
        tools,
        instructions: this.settings.instructions,
        stopWhen: this.settings.stopWhen,
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
      const prepareCallResult = await this.settings.prepareCall(prepareCallInput as any); // TODO: types
      console.log('prepareCallResult', prepareCallResult);
      this.prepareCallResult = prepareCallResult;
    }
  }

  private async handleStopWhen(args: ProcessInputStepArgs) {
    const { steps, abort } = args;
    if (this.settings.stopWhen !== undefined) {
      if (Array.isArray(this.settings.stopWhen)) {
        for (const condition of this.settings.stopWhen) {
          // TODO: Different StepResult type
          const shouldStop = await condition({ steps: steps as StepResult<any>[] });
          if (shouldStop) {
            abort('stopWhen condition met');
          }
        }
      } else if (typeof this.settings.stopWhen === 'function') {
        // TODO: Different StepResult type
        const shouldStop = await this.settings.stopWhen({ steps: steps as StepResult<any>[] });
        if (shouldStop) {
          abort('stopWhen condition met');
        }
      }
    }
  }

  private async handlePrepareStep(args: ProcessInputStepArgs) {
    if (this.settings.prepareStep) {
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

      const prepareStepResult = await this.settings.prepareStep(prepareStepInputArgs);
      return prepareStepResult;
    }
  }

  async processInputStep(args: ProcessInputStepArgs): Promise<ProcessInputStepResult | undefined | void> {
    const { stepNumber } = args;

    if (this.settings.stopWhen !== undefined) {
      await this.handleStopWhen(args);
    }

    if (stepNumber === 0 && this.settings.prepareCall) {
      await this.handlePrepareCall(args);
    }

    let result: ProcessInputStepResult = {};

    // Apply prepareCall result (only on step 0, already called above)
    if (this.prepareCallResult) {
      const mappedResult = this.mapToProcessInputStepResult(this.prepareCallResult);
      result = { ...result, ...mappedResult };
    }

    // Apply prepareStep result (called on every step)
    if (this.settings.prepareStep) {
      const prepareStepResult = await this.handlePrepareStep(args);
      if (prepareStepResult) {
        const mappedResult = this.mapToProcessInputStepResult(prepareStepResult as any);
        // prepareStep overrides prepareCall for this step
        result = { ...result, ...mappedResult };
      }
    }

    return result;
  }
}
