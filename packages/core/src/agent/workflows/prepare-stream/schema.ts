import { z } from 'zod/v4';
import type { MastraBase } from '../../../base';
import type { GuardrailsConfig } from '../../../guardrails';
import type { MastraLLMVNext } from '../../../llm/model/model.loop';
import type { Mastra } from '../../../mastra';
import type {
  ErrorProcessorOrWorkflow,
  InputProcessorOrWorkflow,
  OutputProcessorOrWorkflow,
} from '../../../processors';
import type { RequestContext } from '../../../request-context';
import type { Agent } from '../../agent';
import type { AgentExecuteOnFinishOptions } from '../../types';

export type AgentCapabilities = {
  agent: Agent<any, any, any, any>;
  agentName: string;
  logger: MastraBase['logger'];
  getMemory: Agent['getMemory'];
  getModel: Agent['getModel'];
  generateMessageId: Mastra['generateId'];
  mastra?: Mastra;
  _agentNetworkAppend?: boolean;
  convertTools: Agent['convertTools'];
  runInputProcessors: Agent['__runInputProcessors'];
  executeOnFinish: (args: AgentExecuteOnFinishOptions) => Promise<void>;
  outputProcessors?:
    | OutputProcessorOrWorkflow[]
    | ((args: {
        requestContext: RequestContext;
        overrides?: OutputProcessorOrWorkflow[];
        guardrailOverrides?: GuardrailsConfig;
      }) => Promise<OutputProcessorOrWorkflow[]> | OutputProcessorOrWorkflow[]);
  inputProcessors?:
    | InputProcessorOrWorkflow[]
    | ((args: {
        requestContext: RequestContext;
        overrides?: InputProcessorOrWorkflow[];
        guardrailOverrides?: GuardrailsConfig;
      }) => Promise<InputProcessorOrWorkflow[]> | InputProcessorOrWorkflow[]);
  llmRequestInputProcessors?:
    | InputProcessorOrWorkflow[]
    | ((args: {
        requestContext: RequestContext;
        overrides?: InputProcessorOrWorkflow[];
        guardrailOverrides?: GuardrailsConfig;
      }) => Promise<InputProcessorOrWorkflow[]> | InputProcessorOrWorkflow[]);
  errorProcessors?:
    | ErrorProcessorOrWorkflow[]
    | ((args: {
        requestContext: RequestContext;
        overrides?: ErrorProcessorOrWorkflow[];
      }) => Promise<ErrorProcessorOrWorkflow[]> | ErrorProcessorOrWorkflow[]);
  llm: MastraLLMVNext;
};

export type CoreTool = {
  parameters: any;
  id?: string | undefined;
  description?: string | undefined;
  outputSchema?: any;
  execute?: (inputData: any, context: any) => any;
  toModelOutput?: (output: any) => any;
  type?: 'function' | 'provider-defined' | undefined;
  args?: Record<string, any> | undefined;
};

export const storageThreadSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  resourceId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  metadata: z.record(z.string(), z.any()).optional(),
});

// Step outputs in the evented prepare-stream workflow only carry JSON-safe
// markers — class instances (MessageList, Tools) and Maps (processorStates) live
// on the factory-closure runScope instead. See ./run-scope.ts.
export const prepareToolsStepOutputSchema = z.object({});

export const prepareMemoryStepOutputSchema = z.object({
  threadExists: z.boolean(),
  thread: storageThreadSchema.optional(),
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
