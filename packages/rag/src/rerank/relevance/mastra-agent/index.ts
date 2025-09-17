import { Agent } from '@mastra/core/agent';
import type { MastraLanguageModel } from '@mastra/core/agent';
import { createSimilarityPrompt } from '@mastra/core/relevance';
import type { RelevanceScoreProvider } from '@mastra/core/relevance';

// Mastra Agent implementation
export class MastraAgentRelevanceScorer implements RelevanceScoreProvider {
  private agent: Agent;

  constructor(name: string, model: MastraLanguageModel) {
    this.agent = new Agent({
      name: `Relevance Scorer ${name}`,
      instructions: `You are a specialized agent for evaluating the relevance of text to queries.
Your task is to rate how well a text passage answers a given query.
Output only a number between 0 and 1, where:
1.0 = Perfectly relevant, directly answers the query
0.0 = Completely irrelevant
Consider:
- Direct relevance to the question
- Completeness of information
- Quality and specificity
Always return just the number, no explanation.`,
      model,
    });
  }

  async getRelevanceScore(query: string, text: string): Promise<number> {
    const prompt = createSimilarityPrompt(query, text);

    const model = await this.agent.getModel();
    let response;

    if (model.specificationVersion === 'v2') {
      response = await this.agent.generateVNext(prompt);
    } else {
      response = await this.agent.generate(prompt);
    }

    return parseFloat(response.text);
  }
}
