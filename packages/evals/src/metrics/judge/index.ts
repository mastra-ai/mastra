import { Agent, type ModelConfig } from '@mastra/core';

export abstract class MastraAgentJudge {
  protected readonly agent: Agent;

  constructor(name: string, instructions: string, model: ModelConfig) {
    this.agent = new Agent({
      name: `Mastra Eval Judge ${model.provider} ${name}`,
      instructions: instructions,
      model,
    });
  }
}
