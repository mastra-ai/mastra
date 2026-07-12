import type { ProcessInputStepArgs, ProcessInputStepResult } from '@mastra/core/processors';
import type { RequestContext } from '@mastra/core/request-context';
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
  resolveThreadId: (requestContext?: RequestContext) => string | undefined;
  judgeIntent?: BehaviorIntentJudge;
  resolveModel?: (
    model: string,
    input: { threadId: string; stateId: string; requestContext?: RequestContext },
  ) => Promise<unknown> | unknown;
  resolveSkillInstructions?: (
    skills: readonly string[],
    input: { threadId: string; stateId: string; requestContext?: RequestContext },
  ) => Promise<string[]> | string[];
  unavailableModel?: 'fallback' | 'error';
};

type BehaviorToolContext = { requestContext?: RequestContext; abortSignal?: AbortSignal };
type BehaviorToolFactory = (definition: {
  id: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  execute: (input: any, context: BehaviorToolContext) => Promise<unknown>;
}) => unknown;
const createBehaviorTool = createTool as unknown as BehaviorToolFactory;

class BehaviorRoutingProcessor {
  readonly id: string;
  readonly name = 'Behavior state routing';

  constructor(private readonly options: BehaviorSignalProviderOptions) {
    this.id = `behavior-routing-${options.definition.id}`;
  }

  async processInputStep(args: ProcessInputStepArgs): Promise<ProcessInputStepResult> {
    const threadId = this.options.resolveThreadId(args.requestContext);
    if (!threadId) return {};
    const record = await this.options.store.readThread({ threadId, behaviorId: this.options.definition.id });
    if (!record || record.status !== 'active') return {};
    const state = this.options.definition.states[record.activeState];
    if (!state) return {};
    const resolverInput = { threadId, stateId: state.id, requestContext: args.requestContext };
    const skillInstructions = this.options.resolveSkillInstructions
      ? await this.options.resolveSkillInstructions(state.skills, resolverInput)
      : [];
    const instruction = [state.instructions, ...skillInstructions].filter(Boolean).join('\n\n');
    let model: unknown;
    if (state.model && this.options.resolveModel) {
      model = await this.options.resolveModel(state.model, resolverInput);
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
  private readonly tools: Record<string, unknown>;
  private readonly threadIds = new WeakMap<RequestContext, string>();
  private readonly resolveThreadId: (requestContext?: RequestContext) => string | undefined;

  constructor(readonly options: BehaviorSignalProviderOptions) {
    super();
    this.id = `behavior-${options.definition.id}`;
    this.resolveThreadId = requestContext =>
      options.resolveThreadId(requestContext) ?? (requestContext ? this.threadIds.get(requestContext) : undefined);
    const runtimeOptions = { ...options, resolveThreadId: this.resolveThreadId };
    this.engine = new BehaviorTransitionEngine(options);
    this.stateProcessor = new BehaviorStateProcessor(options.definition, options.store, (requestContext, threadId) => {
      if (requestContext) this.threadIds.set(requestContext, threadId);
    });
    this.intentProcessor = new BehaviorIntentPolicyProcessor(runtimeOptions);
    this.routingProcessor = new BehaviorRoutingProcessor(runtimeOptions);
    this.tools = this.createTools();
  }

  async start(): Promise<void> {
    await this.options.store.init();
  }

  getInputProcessors() {
    return [this.intentProcessor, this.routingProcessor, this.stateProcessor];
  }

  getTools() {
    return this.tools;
  }

  getOutputProcessors() {
    return [this.intentProcessor];
  }

  private createTools(): Record<string, unknown> {
    const threadId = (context: BehaviorToolContext) => {
      const id = this.resolveThreadId(context.requestContext);
      if (!id) throw new Error('Behavior tool requires thread context');
      return id;
    };
    return {
      behavior_select: createBehaviorTool({
        id: 'behavior_select',
        description: 'Start or resume this behavior for the current thread',
        inputSchema: z.object({}),
        execute: async (_input, context) => this.engine.initialize(threadId(context)),
      }),
      behavior_intent: createBehaviorTool({
        id: 'behavior_intent',
        description: 'Set an approved intent for the active behavior state',
        inputSchema: z.object({ intent: z.string().min(1) }),
        execute: async (input, context) => this.intentProcessor.setIntent(threadId(context), input.intent),
      }),
      behavior_transition: createBehaviorTool({
        id: 'behavior_transition',
        description: 'Move through an available behavior transition',
        inputSchema: z.object({
          transition: z.string().min(1),
          attemptId: z.string().min(1).describe('Unique idempotency key; use a new value for every transition attempt'),
        }),
        execute: async (input, context) =>
          this.engine.transition({
            threadId: threadId(context),
            transitionId: input.transition,
            attemptId: input.attemptId,
            signal: context.abortSignal,
          }),
      }),
      behavior_exit: createBehaviorTool({
        id: 'behavior_exit',
        description: 'Exit the active behavior through the current state exit transition',
        inputSchema: z.object({
          attemptId: z.string().min(1).describe('Unique idempotency key; use a new value for this exit attempt'),
        }),
        execute: async (input, context) => {
          const id = threadId(context);
          const record = await this.options.store.readThread({ threadId: id, behaviorId: this.options.definition.id });
          const exit = record ? this.options.definition.states[record.activeState]?.transitions.find(item => item.exit) : undefined;
          if (!exit) throw new Error('Active behavior state has no exit transition');
          return this.engine.transition({ threadId: id, transitionId: exit.id, attemptId: input.attemptId, signal: context.abortSignal });
        },
      }),
    };
  }
}
