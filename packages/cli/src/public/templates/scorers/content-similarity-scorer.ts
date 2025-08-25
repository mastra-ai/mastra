export const contentSimilarityScorer = `
import { createContentSimilarityScorer } from "@mastra/evals/scorers/llm";
 
const scorer = createContentSimilarityScorer();
 
const query = "The quick brown fox jumps over the lazy dog.";
const response = "A quick brown fox jumped over a lazy dog.";
 
const result = await scorer.run({
  input: [{ role: 'user', content: query }],
  output: { text: response },
});
 
console.log(result);
`;
