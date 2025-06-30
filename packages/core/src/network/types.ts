import type { Agent, MastraLanguageModel } from '../agent';

export type AgentNetworkConfig = {
  name: string;
  agents: Agent[];
  model: MastraLanguageModel;
  instructions: string;
};
