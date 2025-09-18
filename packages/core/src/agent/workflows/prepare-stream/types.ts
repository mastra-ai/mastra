import type { MastraBase } from '../../../base';
import type { MastraLLMVNext } from '../../../llm/model/model.loop';
import type { Mastra } from '../../../mastra';
import type { OutputProcessor } from '../../../processors';
import type { DynamicArgument } from '../../../types';
import type { Agent } from '../../agent';
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
