export const textualDifferenceScorer = {
  id: 'textual-difference',
  name: 'Textual Difference',
  description: 'Measures textual differences between strings',
  category: 'accuracy-and-reliability',
  filename: 'textual-difference-scorer.ts',
  type: 'code',
  content: `import { createTextualDifferenceScorer } from "@mastra/evals/scorers/code";
 
const scorer = createTextualDifferenceScorer();
 
const input = 'The quick brown fox jumps over the lazy dog';
const output = 'The quick brown fox jumps over the lazy dog';
 
const result = await scorer.run({
  input: [{ role: 'user', content: input }],
  output: { role: 'assistant', text: output },
});
 
console.log('Score:', result.score);
console.log('AnalyzeStepResult:', result.analyzeStepResult);`
};
