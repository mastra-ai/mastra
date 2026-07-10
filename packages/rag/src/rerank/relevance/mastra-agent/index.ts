import { Agent, isSupportedLanguageModel } from '@mastra/core/agent';
import type { MastraLanguageModel, MastraLegacyLanguageModel } from '@mastra/core/agent';
import { createSimilarityPrompt } from '@mastra/core/relevance';
import type { RelevanceScoreProvider } from '@mastra/core/relevance';

function parseRelevanceScore(responseText: string): number {
  const trimmed = responseText.trim();
  const score = Number(trimmed);

  if (!trimmed || !Number.isFinite(score) || score < 0 || score > 1) {
    throw new Error(`Invalid relevance score returned by model: ${responseText}`);
  }

  return score;
}

// Mastra Agent implementation
export class MastraAgentRelevanceScorer implements RelevanceScoreProvider {
  private agent: Agent;

  constructor(name: string, model: MastraLanguageModel | MastraLegacyLanguageModel) {
    this.agent = new Agent({
      id: `relevance-scorer-${name}`,
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

    if (isSupportedLanguageModel(model)) {
      response = await this.agent.generate(prompt);
    } else {
      response = await this.agent.generateLegacy(prompt);
    }

    return parseRelevanceScore(response.text);
  }
}
