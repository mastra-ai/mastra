export const contentSimilarityScorer = {
  id: 'content-similarity',
  name: 'Content Similarity',
  description: 'Evaluates consistency of information across different phrasings',
  category: 'accuracy-and-reliability',
  filename: 'content-similarity-scorer.ts',
  type: 'code',
  content: `import { createContentSimilarityScorer } from "@mastra/evals/scorers/llm";
 
const scorer = createContentSimilarityScorer();
 
const query = "The quick brown fox jumps over the lazy dog.";
const response = "A quick brown fox jumped over a lazy dog.";
 
const result = await scorer.run({
  input: [{ role: 'user', content: query }],
  output: { text: response },
});
 
console.log(result);`
};
