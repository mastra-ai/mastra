import { Agent, ModelConfig } from '@mastra/core';

export abstract class MastraAgentJudge {
  protected readonly agent: Agent;

  constructor(provider: string, name: string, instructions: string, metric: string) {
    const modelConfig = {
      provider,
      name,
    } as ModelConfig;
    this.agent = new Agent({
      name: `Mastra Eval Judge ${provider} ${name} for ${metric}`,
      instructions: instructions,
      model: modelConfig,
    });
  }
}
