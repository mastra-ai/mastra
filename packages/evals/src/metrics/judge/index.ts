import { Agent } from '@mastra/core/agent';
import type { LanguageModel } from '@mastra/core/llm';

export abstract class MastraAgentJudge {
  protected readonly agent: Agent;

  constructor(name: string, instructions: string, model: LanguageModel) {
    this.agent = new Agent({
      id: `mastra-eval-judge-${name.toLowerCase().replace(/\s+/g, '-')}`,
      name: `Mastra Eval Judge ${name}`,
      instructions: instructions,
      model,
    });
  }
}
