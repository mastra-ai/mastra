import { Agent } from '@mastra/core';
import { type MastraLLMBase } from '@mastra/core/llm';

export abstract class MastraAgentJudge {
  protected readonly agent: Agent;

  constructor(name: string, instructions: string, llm: MastraLLMBase) {
    this.agent = new Agent({
      name: `Mastra Eval Judge ${llm.name} ${name}`,
      instructions: instructions,
      llm,
    });
  }
}
