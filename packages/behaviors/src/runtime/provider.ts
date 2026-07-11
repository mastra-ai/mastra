import type { ProcessInputStepArgs, ProcessInputStepResult } from '@mastra/core/processors';
import { SignalProvider } from '@mastra/core/signals';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { NormalizedBehaviorDefinition } from '../definition/types.js';
import { BehaviorIntentPolicyProcessor, type BehaviorIntentJudge } from '../enforcement/intent-policy.js';
import { BehaviorStateProcessor } from './state-processor.js';
import { BehaviorTransitionEngine, type BehaviorTransitionEngineOptions } from './transition-engine.js';
import type { BehaviorRuntimeStore } from './types.js';

export type BehaviorSignalProviderOptions = Omit<BehaviorTransitionEngineOptions, 'definition' | 'store'> & {
  definition: NormalizedBehaviorDefinition;
  store: BehaviorRuntimeStore;
  judgeIntent?: BehaviorIntentJudge;
  resolveModel?: (model: string, input: { threadId: string; stateId: string }) => Promise<unknown> | unknown;
  resolveSkillInstructions?: (skills: readonly string[], input: { threadId: string; stateId: string }) => Promise<string[]> | string[];
  unavailableModel?: 'fallback' | 'error';
};

type BehaviorToolContext = { threadId?: string; context?: { threadId?: string } };
type BehaviorToolFactory = (definition: {
  id: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  execute: (input: Record<string, unknown>, context?: BehaviorToolContext) => Promise<unknown>;
}) => unknown;
const createBehaviorTool = createTool as unknown as BehaviorToolFactory;

class BehaviorRoutingProcessor {
  readonly id: string;
  readonly name = 'Behavior state routing';

  constructor(private readonly options: BehaviorSignalProviderOptions) {
    this.id = `behavior-routing-${options.definition.id}`;
  }

  async processInputStep(args: ProcessInputStepArgs): Promise<ProcessInputStepResult> {
    const threadId = args.requestContext?.get('threadId');
    if (typeof threadId !== 'string') return {};
    const record = await this.options.store.readThread({ threadId, behaviorId: this.options.definition.id });
    if (!record || record.status !== 'active') return {};
    const state = this.options.definition.states[record.activeState];
    if (!state) return {};
    const skillInstructions = this.options.resolveSkillInstructions
      ? await this.options.resolveSkillInstructions(state.skills, { threadId, stateId: state.id })
      : [];
    const instruction = [state.instructions, ...skillInstructions].filter(Boolean).join('\n\n');
    let model: unknown;
    if (state.model && this.options.resolveModel) {
      model = await this.options.resolveModel(state.model, { threadId, stateId: state.id });
      if (!model && this.options.unavailableModel === 'error') throw new Error(`Behavior model "${state.model}" is unavailable`);
    }
    return {
      ...(model ? { model: model as ProcessInputStepResult['model'] } : {}),
      ...(instruction ? { systemMessages: [...args.systemMessages, { role: 'system', content: instruction }] } : {}),
    };
  }
}

export class BehaviorSignalProvider extends SignalProvider<string> {
  readonly id: string;
  readonly engine: BehaviorTransitionEngine;
  private readonly stateProcessor: BehaviorStateProcessor;
  private readonly intentProcessor: BehaviorIntentPolicyProcessor;
  private readonly routingProcessor: BehaviorRoutingProcessor;

  constructor(readonly options: BehaviorSignalProviderOptions) {
    super();
    this.id = `behavior-${options.definition.id}`;
    this.engine = new BehaviorTransitionEngine(options);
    this.stateProcessor = new BehaviorStateProcessor(options.definition, options.store);
    this.intentProcessor = new BehaviorIntentPolicyProcessor(options);
    this.routingProcessor = new BehaviorRoutingProcessor(options);
  }

  async start(): Promise<void> {
    await this.options.store.init();
  }

  getInputProcessors() {
    return [this.intentProcessor, this.routingProcessor, this.stateProcessor];
  }

  getTools() {
    const threadId = (context?: BehaviorToolContext) => context?.threadId ?? context?.context?.threadId;
    return {
      behavior_select: createBehaviorTool({
        id: 'behavior_select',
        description: 'Start or resume this behavior for the current thread',
        inputSchema: z.object({}),
        execute: async (_input, context) => {
          const id = threadId(context);
          if (!id) throw new Error('behavior_select requires thread context');
          return this.engine.initialize(id);
        },
      }),
      behavior_intent: createBehaviorTool({
        id: 'behavior_intent',
        description: 'Set the intent for the active behavior state',
        inputSchema: z.object({ intent: z.string().min(1) }),
        execute: async (input, context) => {
          const id = threadId(context);
          if (!id) throw new Error('behavior_intent requires thread context');
          const key = { threadId: id, behaviorId: this.options.definition.id };
          const committed = await this.options.store.transactThread(key, current => {
            if (!current || current.status !== 'active') throw new Error('Behavior is not active');
            return { next: { ...current, revision: current.revision + 1, intent: String(input.intent) }, result: undefined };
          });
          return committed.runtime;
        },
      }),
      behavior_transition: createBehaviorTool({
        id: 'behavior_transition',
        description: 'Move through an available behavior transition',
        inputSchema: z.object({ transition: z.string().min(1), attemptId: z.string().min(1) }),
        execute: async (input, context) => {
          const id = threadId(context);
          if (!id) throw new Error('behavior_transition requires thread context');
          return this.engine.transition({ threadId: id, transitionId: String(input.transition), attemptId: String(input.attemptId) });
        },
      }),
      behavior_exit: createBehaviorTool({
        id: 'behavior_exit',
        description: 'Exit the active behavior through its reserved exit transition',
        inputSchema: z.object({ attemptId: z.string().min(1) }),
        execute: async (input, context) => {
          const id = threadId(context);
          if (!id) throw new Error('behavior_exit requires thread context');
          return this.engine.transition({ threadId: id, transitionId: 'exit', attemptId: String(input.attemptId) });
        },
      }),
    };
  }

  getOutputProcessors() {
    return [this.intentProcessor];
  }
}
