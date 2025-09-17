import type { MastraBase } from '../../../base';
import type { MastraLLMVNext } from '../../../llm/model/model.loop';
import type { Mastra } from '../../../mastra';
import type { OutputProcessor } from '../../../processors';
import type { DynamicArgument } from '../../../types';
import type { Agent } from '../../agent';

export type AgentCapabilities = {
  agentName: string;
  agentInstructions: DynamicArgument<string>;
  logger: MastraBase['logger'];
  getMemory: Agent['getMemory'];
  getModel: Agent['getModel'];
  generateMessageId: Mastra['generateId'];
  _agentNetworkAppend?: boolean;
  saveStepMessages: Agent['saveStepMessages'];
  convertTools: Agent['convertTools'];
  getMemoryMessages: Agent['getMemoryMessages'];
  runInputProcessors: Agent['__runInputProcessors'];
  executeOnFinish: (params: any) => Promise<void>;
  outputProcessors?: DynamicArgument<OutputProcessor[]>;
  llm: MastraLLMVNext;
};
