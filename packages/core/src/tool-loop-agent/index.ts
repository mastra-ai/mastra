import {
  ToolLoopAgent,
  type AgentCallParameters,
  type MaybePromiseLike,
  type Prompt,
  type StepResult,
  type StopCondition,
  type ToolLoopAgentSettings,
} from '@internal/ai-v6';
import { generateId } from '@internal/ai-sdk-v5';
import { Agent, isSupportedLanguageModel, type AgentExecutionOptions, type AgentInstructions } from '../agent';
import type { MastraScorers } from '../evals';
import type { Mastra } from '../mastra';
import type { MastraMemory } from '../memory';
import type {
  InputProcessorOrWorkflow,
  OutputProcessorOrWorkflow,
  ProcessInputArgs,
  ProcessInputResult,
  ProcessInputStepArgs,
  ProcessInputStepResult,
  Processor,
  ProcessorMessageResult,
  ProcessOutputStepArgs,
} from '../processors';
import type { CompositeVoice } from '../voice';
import type { OutputSchema } from '../stream';
import { resolveModelConfig } from '../llm';

/**
 * Options for converting a ToolLoopAgent to a Mastra Agent.
 * Allows adding Mastra-specific features that aren't available in ToolLoopAgent.
 */
export interface ToolLoopAgentWrapperOptions {
  /**
   * Override the agent name (defaults to agent.id or 'tool-loop-agent')
   */
  name?: string;

  /**
   * Add memory support for conversation persistence
   */
  memory?: MastraMemory;

  /**
   * Add scorers for runtime evaluation
   */
  scorers?: MastraScorers;

  /**
   * Add input processors for message transformation/validation
   */
  inputProcessors?: InputProcessorOrWorkflow[];

  /**
   * Add output processors for response transformation/validation
   */
  outputProcessors?: OutputProcessorOrWorkflow[];

  /**
   * Add voice support for speech input/output
   */
  voice?: CompositeVoice;

  /**
   * Reference to Mastra runtime instance
   */
  mastra?: Mastra;

  /**
   * Maximum number of processor retries
   */
  maxProcessorRetries?: number;
}

/**
 * Shape of a ToolLoopAgent-like object for runtime extraction.
 * We use this looser type because TypeScript's structural typing doesn't work
 * well with private properties across different package declarations.
 */
export interface ToolLoopAgentLike {
  readonly id?: string;
  readonly version?: string;
  // The settings property is private in ToolLoopAgent but accessible at runtime
  // We don't declare it here since we access it via type casting
}

/**
 * Extracts the settings from a ToolLoopAgent instance.
 * ToolLoopAgent.settings is private in TypeScript but accessible at runtime.
 */
function extractSettingsFromToolLoopAgent(agent: ToolLoopAgentLike): ToolLoopAgentSettings<any, any, any> {
  // Access the private settings property at runtime
  const settings = (agent as unknown as { settings: ToolLoopAgentSettings<any, any, any> }).settings;

  if (!settings) {
    throw new Error('Could not extract settings from ToolLoopAgent. The agent may be from an incompatible version.');
  }

  return settings;
}

/**
 * Extracts the maxSteps value from a ToolLoopAgent's stopWhen condition.
 * Currently only supports stepCountIs() style conditions.
 *
 * @param stopWhen - The stopWhen condition from ToolLoopAgent
 * @returns The max steps number, or undefined if not extractable
 */
function extractMaxStepsFromStopWhen(stopWhen: unknown): number | undefined {
  if (!stopWhen) return undefined;

  // Handle array of conditions - look for step count condition
  if (Array.isArray(stopWhen)) {
    for (const condition of stopWhen) {
      const steps = extractMaxStepsFromStopWhen(condition);
      if (steps !== undefined) return steps;
    }
    return undefined;
  }

  // Try to extract step count from condition object
  // The stepCountIs() helper typically creates an object with a maxSteps or similar property
  if (typeof stopWhen === 'object' && stopWhen !== null) {
    const condition = stopWhen as Record<string, unknown>;

    // Check common property names that might indicate step count
    if (typeof condition.maxSteps === 'number') {
      return condition.maxSteps;
    }
    if (typeof condition.stepCount === 'number') {
      return condition.stepCount;
    }
    if (typeof condition.steps === 'number') {
      return condition.steps;
    }
  }

  return undefined;
}

/**
 * Creates a Mastra Agent from ToolLoopAgentSettings config.
 * Internal helper used by both the instance and config-based wrappers.
 */
function createMastraAgentFromToolLoopAgent({
  agent,
  options,
}: {
  agent: ToolLoopAgentLike;
  options: ToolLoopAgentWrapperOptions;
}) {
  const tools = (agent as ToolLoopAgent).tools;
  const settings = extractSettingsFromToolLoopAgent(agent);

  console.log('tools', tools);
  // TODO: Maybe we need to move stopWhen call to processOutputStep or processOutput?
  // Extract maxSteps from stopWhen if possible
  const maxSteps = extractMaxStepsFromStopWhen(settings.stopWhen);
  console.log('extracted maxSteps', maxSteps);

  // Build default options from ToolLoopAgent config params
  const defaultOptions: Omit<AgentExecutionOptions<OutputSchema>, 'abortSignal'> = {};

  // AgentExecutionOptions
  if (maxSteps !== undefined) {
    defaultOptions.maxSteps = maxSteps;
  }
  if (settings.toolChoice) {
    defaultOptions.toolChoice = settings.toolChoice;
  }
  if (settings.providerOptions) {
    defaultOptions.providerOptions = settings.providerOptions;
  }
  // AgentExecutionOptions["modelSettings"]
  if (settings.temperature !== undefined) {
    defaultOptions.modelSettings = { ...(defaultOptions.modelSettings ?? {}), temperature: settings.temperature };
  }
  if (settings.topP !== undefined) {
    defaultOptions.modelSettings = { ...(defaultOptions.modelSettings ?? {}), topP: settings.topP };
  }
  if (settings.topK !== undefined) {
    defaultOptions.modelSettings = { ...(defaultOptions.modelSettings ?? {}), topK: settings.topK };
  }
  if (settings.seed !== undefined) {
    defaultOptions.modelSettings = { ...(defaultOptions.modelSettings ?? {}), seed: settings.seed };
  }
  if (settings.maxOutputTokens !== undefined) {
    defaultOptions.modelSettings = {
      ...(defaultOptions.modelSettings ?? {}),
      maxOutputTokens: settings.maxOutputTokens,
    };
  }

  // TODO: what is presencePenalty
  // if (settings.presencePenalty !== undefined) {
  //   defaultOptions.presencePenalty = settings.presencePenalty;
  // }
  // TODO: what is frequencyPenalty
  // if (settings.frequencyPenalty !== undefined) {
  //   defaultOptions.frequencyPenalty = settings.frequencyPenalty;
  // }
  // TODO: what is stopSequences
  // if (settings.stopSequences !== undefined) {
  //   defaultOptions.stopSequences = settings.stopSequences;
  // }

  if (settings.onStepFinish) {
    // TODO: whats different about our onStepFinish vs ToolLoopAgent's?
    // @ts-expect-error
    defaultOptions.onStepFinish = settings.onStepFinish;
  }

  if (settings.onFinish) {
    // TODO: whats different about our onFinish vs ToolLoopAgent's?
    // @ts-expect-error
    defaultOptions.onFinish = settings.onFinish;
  }

  // Create the Mastra Agent
  // Cast model and instructions to work around AI SDK v6 / Mastra type differences
  const id = settings.id ?? options.name ?? `tool-loop-agent-${generateId()}`;
  const mastraAgent = new Agent({
    id,
    name: id,
    instructions: (settings.instructions as AgentInstructions) ?? '',
    model: settings.model,
    tools: settings.tools,
    maxRetries: settings.maxRetries,
    inputProcessors: [
      new ToolLoopToMastraAgent({
        settings,
      }),
    ],
    outputProcessors: [
      new ToolLoopToMastraAgent({
        settings,
      }),
    ],
    // Default options from ToolLoopAgent config
    defaultOptions: Object.keys(defaultOptions).length > 0 ? defaultOptions : undefined,

    // Mastra-specific options from wrapper
    // memory: options.memory,
    // scorers: options.scorers,
    // inputProcessors: options.inputProcessors,
    // outputProcessors: options.outputProcessors,
    // voice: options.voice,
    // mastra: options.mastra,
    // maxProcessorRetries: options.maxProcessorRetries,
  });

  return mastraAgent;
}

/**
 * Converts an AI SDK v6 ToolLoopAgent instance into a Mastra Agent.
 *
 * This enables users to create a ToolLoopAgent using AI SDK's API
 * while gaining access to Mastra features like memory, processors, scorers, and observability.
 *
 * @example
 * ```typescript
 * import { ToolLoopAgent, tool } from 'ai';
 * import { openai } from '@ai-sdk/openai';
 * import { toolLoopAgentToMastraAgent } from '@mastra/core/tool-loop-agent';
 * import { Memory } from '@mastra/memory';
 *
 * const toolLoopAgent = new ToolLoopAgent({
 *   id: 'weather-agent',
 *   model: openai('gpt-4o'),
 *   instructions: 'You are a helpful weather assistant.',
 *   tools: { weather: weatherTool },
 *   temperature: 0.7,
 * });
 *
 * const mastraAgent = toolLoopAgentToMastraAgent(toolLoopAgent, {
 *   memory: new Memory(),
 * });
 *
 * const result = await mastraAgent.generate({ prompt: 'What is the weather in NYC?' });
 * ```
 *
 * @param agent - The ToolLoopAgent instance
 * @param options - Additional Mastra-specific configuration options
 * @returns A Mastra Agent instance
 */
export function toolLoopAgentToMastraAgent(agent: ToolLoopAgentLike, options: ToolLoopAgentWrapperOptions = {}) {
  return createMastraAgentFromToolLoopAgent({ agent, options });
}

export function isToolLoopAgentLike(obj: any): obj is ToolLoopAgentLike {
  if (!obj) return false;
  if (obj instanceof ToolLoopAgent) return true;
  return 'version' in obj && (obj.version === 'agent-v1' || obj.version.startsWith('agent-v'));
}

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

type Thing = PrepareCallInput['messages'];

export class ToolLoopToMastraAgent implements Processor<'tool-loop-to-mastra-agent'> {
  readonly id = 'tool-loop-to-mastra-agent';
  readonly name = 'ToolLoop to Mastra Agent Processor';
  private settings: ToolLoopAgentSettings<any, any, any>;

  constructor({ settings }: { settings: ToolLoopAgentSettings<any, any, any> }) {
    this.settings = settings;
  }

  // TODO: We need to be able to do more with processInput, like we can with processInputStep
  // async processInput({ messages, messageList, abort }: ProcessInputArgs): Promise<ProcessInputResult> {
  //   // TODO: Map ToolLoopAgent prepareCall to Mastra processInput
  //   return messageList;
  // }

  async processInputStep(args: ProcessInputStepArgs): Promise<ProcessInputStepResult | undefined | void> {
    const { stepNumber, model, messages, activeTools, providerOptions, modelSettings } = args;

    // prepareCall is only called at step 0 (before the first LLM call)
    if (stepNumber === 0 && this.settings.prepareCall) {
      // TODO: This needs to happen in processInput
      const resolvedModel = await resolveModelConfig(model);
      if (!isSupportedLanguageModel(resolvedModel)) {
        throw new Error('Only v2/v3 models are supported in ToolLoopAgent');
      }
      // Build the prepareCall input object
      // AI SDK prepareCall expects: AgentCallParameters & Pick<ToolLoopAgentSettings, ...settings>
      const prepareCallInput: PrepareCallInput = {
        // AgentCallParameters - we pass messages (user input is in messages)
        // TODO: prepareCall expects messages in AI SDK format, we have them in Mastra format
        messages: messages as unknown as any,

        // Settings from ToolLoopAgentSettings that prepareCall can override
        model: resolvedModel,
        tools: this.settings.tools,
        instructions: this.settings.instructions,
        stopWhen: this.settings.stopWhen,
        activeTools: activeTools ?? this.settings.activeTools,
        providerOptions: providerOptions ?? this.settings.providerOptions,

        // Model settings
        temperature: modelSettings?.temperature ?? this.settings.temperature,
        topP: modelSettings?.topP ?? this.settings.topP,
        topK: modelSettings?.topK ?? this.settings.topK,
        maxOutputTokens: modelSettings?.maxOutputTokens ?? this.settings.maxOutputTokens,
        presencePenalty: modelSettings?.presencePenalty ?? this.settings.presencePenalty,
        frequencyPenalty: modelSettings?.frequencyPenalty ?? this.settings.frequencyPenalty,
        stopSequences: modelSettings?.stopSequences ?? this.settings.stopSequences,
        seed: modelSettings?.seed ?? this.settings.seed,

        // Experimental options
        // experimental_telemetry: this.settings.experimental_telemetry,
        // experimental_context: this.settings.experimental_context,
        // experimental_download: this.settings.experimental_download,
      };
      console.log('prepareCallInput', prepareCallInput);

      // Call prepareCall and apply any returned overrides
      const prepareCallResult = await this.settings.prepareCall(prepareCallInput as any);
      console.log('prepareCallResult', prepareCallResult);

      // if (prepareCallResult) {
      //   // Build ProcessInputStepResult from prepareCall result
      //   const result: ProcessInputStepResult = {};

      //   if (prepareCallResult.model !== undefined) {
      //     result.model = prepareCallResult.model as any;
      //   }
      //   if (prepareCallResult.tools !== undefined) {
      //     result.tools = prepareCallResult.tools as any;
      //   }
      //   if (prepareCallResult.activeTools !== undefined) {
      //     result.activeTools = prepareCallResult.activeTools as string[];
      //   }
      //   if (prepareCallResult.providerOptions !== undefined) {
      //     result.providerOptions = prepareCallResult.providerOptions as any;
      //   }

      //   // Map model settings
      //   const newModelSettings: ProcessInputStepResult['modelSettings'] = {};
      //   if (prepareCallResult.temperature !== undefined) newModelSettings.temperature = prepareCallResult.temperature;
      //   if (prepareCallResult.topP !== undefined) newModelSettings.topP = prepareCallResult.topP;
      //   if (prepareCallResult.topK !== undefined) newModelSettings.topK = prepareCallResult.topK;
      //   if (prepareCallResult.maxOutputTokens !== undefined)
      //     newModelSettings.maxOutputTokens = prepareCallResult.maxOutputTokens;
      //   if (prepareCallResult.presencePenalty !== undefined)
      //     newModelSettings.presencePenalty = prepareCallResult.presencePenalty;
      //   if (prepareCallResult.frequencyPenalty !== undefined)
      //     newModelSettings.frequencyPenalty = prepareCallResult.frequencyPenalty;
      //   if (prepareCallResult.stopSequences !== undefined)
      //     newModelSettings.stopSequences = prepareCallResult.stopSequences;
      //   if (prepareCallResult.seed !== undefined) newModelSettings.seed = prepareCallResult.seed;

      //   if (Object.keys(newModelSettings).length > 0) {
      //     result.modelSettings = newModelSettings;
      //   }

      //   // Handle instructions override - map to systemMessages
      //   if (prepareCallResult.instructions !== undefined) {
      //     result.systemMessages = [
      //       {
      //         role: 'system' as const,
      //         content: prepareCallResult.instructions as string,
      //       },
      //     ];
      //   }

      //   // Handle prompt override (converts to messages)
      //   if (prepareCallResult.prompt !== undefined) {
      //     const promptContent =
      //       typeof prepareCallResult.prompt === 'string'
      //         ? prepareCallResult.prompt
      //         : JSON.stringify(prepareCallResult.prompt);
      //     result.messages = [
      //       {
      //         id: crypto.randomUUID(),
      //         createdAt: new Date(),
      //         threadId: '',
      //         role: 'user' as const,
      //         content: {
      //           format: 2 as const,
      //           parts: [{ type: 'text' as const, text: promptContent }],
      //         },
      //       },
      //     ];
      //   }

      //   return result;
      // }
    }

    // TODO: Map ToolLoopAgent prepareStep to Mastra processInputStep (for stepNumber > 0)
    return;
  }

  async processOutputStep({ steps, abort, messageList }: ProcessOutputStepArgs) {
    if (this.settings.stopWhen !== undefined) {
      if (Array.isArray(this.settings.stopWhen)) {
        for (const condition of this.settings.stopWhen) {
          const shouldStop = await condition({ steps: steps as StepResult<any>[] });
          if (shouldStop) {
            abort('stopWhen condition met');
          }
        }
      } else if (typeof this.settings.stopWhen === 'function') {
        const shouldStop = await this.settings.stopWhen({ steps: steps as StepResult<any>[] });
        if (shouldStop) {
          abort('stopWhen condition met');
        }
      }
    }

    return messageList;
  }
}
