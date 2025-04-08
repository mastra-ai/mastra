import type { LanguageModelV1 } from 'ai';
import type { Agent } from '../agent';

export type AgentNetworkConfig = {
  name: string;
  agents: Agent[];
  model: LanguageModelV1;
  instructions: string;
};
