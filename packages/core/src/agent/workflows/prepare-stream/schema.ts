import { z } from 'zod';
import type { MastraBase } from '../../../base';
import type { MastraLLMVNext } from '../../../llm/model/model.loop';
import type { Mastra } from '../../../mastra';
import type { InputProcessorOrWorkflow, OutputProcessorOrWorkflow } from '../../../processors';
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
  runInputProcessors: Agent['__runInputProcessors'];
  executeOnFinish: (args: AgentExecuteOnFinishOptions) => Promise<void>;
  outputProcessors?: DynamicArgument<OutputProcessorOrWorkflow[]>;
  inputProcessors?: DynamicArgument<InputProcessorOrWorkflow[]>;
  llm: MastraLLMVNext;
};

export type CoreTool = {
  parameters: any;
  id?: string;
  description?: string;
  outputSchema?: any;
  execute?: (params: any, options: any) => Promise<any>;
  type?: 'function' | 'provider-defined';
  args?: Record<string, any>;
};

export const storageThreadSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  resourceId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const prepareToolsStepOutputSchema = z.object({
  convertedTools: z.record(z.string(), z.any()),
});

export const prepareMemoryStepOutputSchema = z.object({
  threadExists: z.boolean(),
  thread: storageThreadSchema.optional(),
  messageList: z.instanceof(MessageList),
  /** Tripwire data when input processor triggered abort */
  tripwire: z
    .object({
      reason: z.string(),
      retry: z.boolean().optional(),
      metadata: z.unknown().optional(),
      processorId: z.string().optional(),
    })
    .optional(),
});

export type PrepareMemoryStepOutput = z.infer<typeof prepareMemoryStepOutputSchema>;
export type PrepareToolsStepOutput = z.infer<typeof prepareToolsStepOutputSchema>;
