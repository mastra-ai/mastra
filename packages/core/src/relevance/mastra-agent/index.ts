import { Agent } from '../../agent';
import { ModelConfig } from '../../llm/types';
import { RelevanceScoreProvider, createSimilarityPrompt } from '../relevance-score-provider';

// Mastra Agent implementation
export class MastraAgentRelevanceScorer implements RelevanceScoreProvider {
  private agent: Agent;

  constructor(provider: string, name: string) {
    const modelConfig = {
      provider,
      name,
    } as ModelConfig;
    this.agent = new Agent({
      name: `Relevance Scorer ${provider} ${name}`,
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
      model: modelConfig,
    });
  }

  async getRelevanceScore(query: string, text: string): Promise<number> {
    const prompt = createSimilarityPrompt(query, text);
    const response = await this.agent.generate(prompt);
    return parseFloat(response.text);
  }
}