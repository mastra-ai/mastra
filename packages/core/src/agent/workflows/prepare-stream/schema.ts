import { z } from 'zod';
import type { MastraBase } from '../../../base';
import type { MastraLLMVNext } from '../../../llm/model/model.loop';
import type { Mastra } from '../../../mastra';
import type { OutputProcessor } from '../../../processors';
import type { DynamicArgument } from '../../../types';
import type { Agent } from '../../agent';
import { MessageList } from '../../message-list';
import type { AgentExecuteOnFinishOptions } from '../../types';

export type AgentCapabilities = {
  agentName: string;
  logger: MastraBase['logger'];
  getMemory: Agent['getMemory'];
  getModel: Agent['getModel'];
  generateMessageId: Mastra['generateId'];
  _agentNetworkAppend?: boolean;
  saveStepMessages: Agent['saveStepMessages'];
  convertTools: Agent['convertTools'];
  getMemoryMessages: Agent['getMemoryMessages'];
  runInputProcessors: Agent['__runInputProcessors'];
  executeOnFinish: (args: AgentExecuteOnFinishOptions) => Promise<void>;
  outputProcessors?: DynamicArgument<OutputProcessor[]>;
  llm: MastraLLMVNext;
};

const coreToolSchema = z.object({
  id: z.string().optional(),
  description: z.string().optional(),
  parameters: z.union([
    z.record(z.string(), z.any()), // JSON Schema as object
    z.any(), // Zod schema or other schema types - validated at tool execution
  ]),
  outputSchema: z.union([z.record(z.string(), z.any()), z.any()]).optional(),
  execute: z.function(z.tuple([z.any(), z.any()]), z.promise(z.any())).optional(),
  type: z.union([z.literal('function'), z.literal('provider-defined'), z.undefined()]).optional(),
  args: z.record(z.string(), z.any()).optional(),
});

export type CoreTool = z.infer<typeof coreToolSchema>;

export const storageThreadSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  resourceId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const prepareToolsStepOutputSchema = z.object({
  convertedTools: z.record(z.string(), coreToolSchema),
});

export const prepareMemoryStepOutputSchema = z.object({
  threadExists: z.boolean(),
  thread: storageThreadSchema.optional(),
  messageList: z.instanceof(MessageList),
  tripwire: z.boolean().optional(),
  tripwireReason: z.string().optional(),
});

export type PrepareMemoryStepOutput = z.infer<typeof prepareMemoryStepOutputSchema>;
export type PrepareToolsStepOutput = z.infer<typeof prepareToolsStepOutputSchema>;
