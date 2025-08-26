export const keywordCoverageScorer = `
import { createKeywordCoverageScorer } from "@mastra/evals/scorers/code";
 
const scorer = createKeywordCoverageScorer();
 
const input = 'JavaScript frameworks like React and Vue';
const output = 'Popular JavaScript frameworks include React and Vue for web development';
 
const result = await scorer.run({
  input: [{ role: 'user', content: input }],
  output: { role: 'assistant', text: output },
});
 
console.log('Score:', result.score);
console.log('AnalyzeStepResult:', result.analyzeStepResult);`;
