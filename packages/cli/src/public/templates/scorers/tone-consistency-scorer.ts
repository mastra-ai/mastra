export const toneConsistencyScorer = `
import { createToneScorer } from "@mastra/evals/scorers/code";
 
const scorer = createToneScorer();
 
const input = 'This product is fantastic and amazing!';
const output = 'The product is excellent and wonderful!';
 
const result = await scorer.run({
  input: [{ role: 'user', content: input }],
  output: { role: 'assistant', text: output },
});
 
console.log('Score:', result.score);
console.log('AnalyzeStepResult:', result.analyzeStepResult);
`;
