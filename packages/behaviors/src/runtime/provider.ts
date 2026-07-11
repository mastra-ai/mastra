import type { ProcessInputStepArgs, ProcessInputStepResult } from '@mastra/core/processors';
import type { RequestContext } from '@mastra/core/request-context';
import { SignalProvider } from '@mastra/core/signals';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { NormalizedBehaviorDefinition } from '../definition/types.js';
import { BehaviorIntentPolicyProcessor, type BehaviorIntentJudge } from '../enforcement/intent-policy.js';
import { BehaviorScheduler, type BehaviorAuditEvent } from '../scheduler/scheduler.js';
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
  scheduler?: false | {
    intervalMs?: number;
    leaseMs?: number;
    retryBackoffMs?: number;
    onAudit?: (event: BehaviorAuditEvent) => void | Promise<void>;
  };
};

type BehaviorToolContext = {
  requestContext?: RequestContext;
  abortSignal?: AbortSignal;
  agent?: { toolCallId?: string };
};
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

  constructor(
    private readonly options: BehaviorSignalProviderOptions,
    private readonly engine: BehaviorTransitionEngine,
  ) {
    this.id = `behavior-routing-${options.definition.id}`;
  }

  async processInputStep(args: ProcessInputStepArgs): Promise<ProcessInputStepResult> {
    const threadId = this.options.resolveThreadId(args.requestContext);
    if (!threadId) return {};
    const record =
      (await this.options.store.readThread({ threadId, behaviorId: this.options.definition.id })) ??
      (await this.engine.initialize(threadId));
    if (record.status !== 'active') return {};
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
  private readonly scheduler?: BehaviorScheduler;
  private readonly threadIds = new WeakMap<RequestContext, string>();
  private readonly resolveThreadId: (requestContext?: RequestContext) => string | undefined;

  constructor(readonly options: BehaviorSignalProviderOptions) {
    super();
    this.id = `behavior-${options.definition.id}`;
    this.resolveThreadId = requestContext =>
      options.resolveThreadId(requestContext) ?? (requestContext ? this.threadIds.get(requestContext) : undefined);
    const runtimeOptions = { ...options, resolveThreadId: this.resolveThreadId };
    this.engine = new BehaviorTransitionEngine(options);
    this.stateProcessor = new BehaviorStateProcessor(
      options.definition,
      options.store,
      (requestContext, threadId) => {
        if (requestContext) this.threadIds.set(requestContext, threadId);
      },
      threadId => this.engine.initialize(threadId),
    );
    this.intentProcessor = new BehaviorIntentPolicyProcessor(runtimeOptions);
    this.routingProcessor = new BehaviorRoutingProcessor(runtimeOptions, this.engine);
    this.tools = this.createTools();
    if (options.scheduler !== false) {
      this.scheduler = new BehaviorScheduler({
        behaviorId: options.definition.id,
        definition: options.definition,
        store: options.store,
        engine: this.engine,
        ...options.scheduler,
      });
    }
  }

  async start(): Promise<void> {
    await this.options.store.init();
    this.scheduler?.start();
  }

  async stop(): Promise<void> {
    this.scheduler?.stop();
    super.stop();
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
      behavior: createBehaviorTool({
        id: 'behavior',
        description: 'Move to an available behavior connected to the current behavior',
        inputSchema: z.object({
          name: z.string().min(1).describe('Name of the destination behavior'),
        }),
        execute: async (input, context) =>
          this.engine.transition({
            threadId: threadId(context),
            name: input.name,
            idempotencyKey: context.agent?.toolCallId,
            signal: context.abortSignal,
          }),
      }),
      behavior_intent: createBehaviorTool({
        id: 'behavior_intent',
        description: 'Set an approved intent for the active behavior state',
        inputSchema: z.object({ intent: z.string().min(1) }),
        execute: async (input, context) => this.intentProcessor.setIntent(threadId(context), input.intent),
      }),
    };
  }
}
