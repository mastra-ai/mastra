export const answerRelevancyScorer = `
import { openai } from "@ai-sdk/openai";
import { createAnswerRelevancyScorer } from "@mastra/evals/scorers/llm";
 
const scorer = createAnswerRelevancyScorer({ model: openai("gpt-4o-mini") });
 
const inputMessages = [{ role: 'user', content: "What are the health benefits of regular exercise?" }];
const outputMessage = { text: "Regular exercise improves cardiovascular health, strengthens muscles, boosts metabolism, and enhances mental well-being through the release of endorphins." };
 
const result = await scorer.run({
  input: inputMessages,
  output: outputMessage,
});
console.log(result);
`;
