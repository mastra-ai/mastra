import type {
  ProcessInputStepArgs,
  ProcessInputStepResult,
  ProcessOutputStepArgs,
} from '@mastra/core/processors';
import { z } from 'zod';

import type { NormalizedBehaviorDefinition } from '../definition/types.js';
import type { BehaviorRuntimeRecord, BehaviorRuntimeStore } from '../runtime/types.js';

export const behaviorIntentField = 'intent';

export type BehaviorIntentJudge = (input: {
  intent: string;
  toolName: string;
  record: BehaviorRuntimeRecord;
  allowedTools: readonly string[];
}) => Promise<{ approved: boolean; feedback?: string }>;

export type BehaviorIntentPolicyOptions = {
  definition: NormalizedBehaviorDefinition;
  store: BehaviorRuntimeStore;
  judgeIntent?: BehaviorIntentJudge;
};

type ToolLike = {
  inputSchema?: unknown;
  execute?: (input: Record<string, unknown>, context?: unknown) => unknown;
  [key: string]: unknown;
};

const getThreadId = (value: unknown): string | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.threadId === 'string') return record.threadId;
  return getThreadId(record.context) ?? getThreadId(record.requestContext);
};

export class BehaviorIntentPolicyProcessor {
  readonly id: string;
  readonly name = 'Behavior intent policy';
  private readonly wrappers = new WeakMap<object, ToolLike>();

  constructor(private readonly options: BehaviorIntentPolicyOptions) {
    this.id = `behavior-intent-${options.definition.id}`;
  }

  async processInputStep(args: ProcessInputStepArgs): Promise<ProcessInputStepResult> {
    if (!args.tools) return {};
    const tools = Object.fromEntries(
      Object.entries(args.tools).map(([name, tool]) => [name, this.wrapTool(name, tool as ToolLike)]),
    );
    return { tools };
  }

  async processOutputStep(args: ProcessOutputStepArgs) {
    for (const call of args.toolCalls ?? []) {
      const intent = this.readIntent(call.args);
      if (!intent) args.abort(`Tool "${call.toolName}" requires an intent`, { retry: true });
    }
    return args.messages;
  }

  private wrapTool(name: string, tool: ToolLike): ToolLike {
    if (!tool || typeof tool !== 'object' || typeof tool.execute !== 'function' || name.startsWith('behavior_')) return tool;
    const cached = this.wrappers.get(tool);
    if (cached) return cached;
    const originalExecute = tool.execute.bind(tool);
    const inputSchema = this.extendSchema(tool.inputSchema);
    const wrapped: ToolLike = {
      ...tool,
      inputSchema,
      execute: async (input, context) => {
        const threadId = getThreadId(context);
        if (!threadId) throw new Error(`Tool "${name}" requires behavior thread context`);
        await this.authorize(threadId, name, this.readIntent(input));
        const { intent: _intent, ...originalInput } = input;
        return originalExecute(originalInput, context);
      },
    };
    this.wrappers.set(tool, wrapped);
    return wrapped;
  }

  private extendSchema(schema: unknown): unknown {
    const intent = z.string().min(1).describe('Current behavior state name or a judged explanation of intent');
    if (schema instanceof z.ZodObject) return schema.extend({ intent });
    return z.object({ intent }).passthrough();
  }

  private readIntent(input: unknown): string | undefined {
    if (!input || typeof input !== 'object') return undefined;
    const value = (input as Record<string, unknown>)[behaviorIntentField];
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private async authorize(threadId: string, toolName: string, intent?: string): Promise<void> {
    if (!intent) throw new Error(`Tool "${toolName}" requires an intent`);
    const record = await this.options.store.readThread({ threadId, behaviorId: this.options.definition.id });
    if (!record || record.status !== 'active') throw new Error('Behavior is not active');
    const state = this.options.definition.states[record.activeState];
    if (!state) throw new Error(`Behavior state "${record.activeState}" is unavailable`);
    if (state.tools.length && !state.tools.includes(toolName)) throw new Error(`Tool "${toolName}" is not allowed in state "${state.id}"`);
    if (intent === state.id) return;
    if (!this.options.judgeIntent) throw new Error(`Intent must equal active state "${state.id}"`);
    const result = await this.options.judgeIntent({ intent, toolName, record, allowedTools: state.tools });
    if (!result.approved) throw new Error(result.feedback ?? `Intent was rejected for tool "${toolName}"`);
  }
}
