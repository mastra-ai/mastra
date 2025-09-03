export const CONTEXT_PRECISION_AGENT_INSTRUCTIONS = `You are a precise context precision evaluator. Your job is to determine if context nodes are relevant for generating the expected output based on the input query.

Key Principles:
1. Evaluate each context piece independently for relevance to the input-output pair
2. Consider relevance as the ability of the context to contribute to generating the expected output
3. Mark context as relevant only if it directly supports or informs the expected output
4. Consider the input query when determining relevance
5. Focus on practical utility for output generation, not just topical similarity
6. Be strict in your evaluation - context must be clearly useful for generating the output
7. Context that provides background but doesn't directly contribute should be marked as not relevant`;

export function createContextRelevancePrompt({
  input,
  output,
  context,
}: {
  input: string;
  output: string;
  context: string[];
}) {
  return `Evaluate the relevance of each context piece for generating the expected output given the input query.

Input Query:
${input}

Expected Output:
${output}

Context pieces to evaluate:
${context.map((ctx, index) => `[${index}] ${ctx}`).join('\n')}

For each context piece, determine if it is relevant for generating the expected output. A context piece is relevant if:
- It provides information that directly supports or informs the expected output
- It contains facts, data, or details that are needed to answer the input query
- It contributes to the accuracy or completeness of the expected output

Mark as "yes" only if the context piece is clearly useful for generating the output.
Mark as "no" if the context piece does not contribute to generating the expected output.

Format your response as:
{
  "verdicts": [
    {
      "context_index": 0,
      "verdict": "yes/no",
      "reason": "explanation of why this context is or isn't relevant"
    }
  ]
}

The number of verdicts MUST match the number of context pieces exactly.

Example:
Input: "What are the benefits of exercise?"
Output: "Regular exercise improves cardiovascular health and mental wellbeing."
Context: 
[0] "Exercise strengthens the heart and improves blood circulation."
[1] "A balanced diet is important for health."
[2] "Regular physical activity reduces stress and anxiety."

{
  "verdicts": [
    {
      "context_index": 0,
      "verdict": "yes",
      "reason": "This context directly supports the cardiovascular health benefit mentioned in the output"
    },
    {
      "context_index": 1,
      "verdict": "no", 
      "reason": "This context is about diet, not exercise benefits, and doesn't contribute to the expected output"
    },
    {
      "context_index": 2,
      "verdict": "yes",
      "reason": "This context directly supports the mental wellbeing benefit mentioned in the output"
    }
  ]
}`;
}

export function createContextPrecisionReasonPrompt({
  input,
  output,
  context,
  score,
  scale,
  verdicts,
}: {
  input: string;
  output: string;
  context: string[];
  score: number;
  scale: number;
  verdicts: { context_index: number; verdict: string; reason: string }[];
}) {
  return `Explain the context precision score for the retrieved context based on its relevance to generating the expected output.

Input Query:
${input}

Expected Output:
${output}

Context pieces:
${context.map((ctx, index) => `[${index}] ${ctx}`).join('\n')}

Score: ${score} out of ${scale}
Verdicts:
${JSON.stringify(verdicts, null, 2)}

Context Precision measures how relevant and precise the retrieved context nodes are for generating the expected output. The score is calculated using Mean Average Precision (MAP) which:
- Gives binary relevance scores (1 for relevant, 0 for irrelevant)  
- Weights earlier positions more heavily in the scoring
- Rewards having relevant context early in the sequence

Rules for explanation:
- Explain the score based on which context pieces were relevant and their positions
- Mention how the positioning affects the MAP score
- Keep explanation concise and focused on context quality
- Use the given score, don't recalculate
- Focus on how well the context supports generating the expected output

Format:
"The score is ${score} because {explanation of context precision and positioning}"

Example responses:
"The score is 0.75 because the first and third contexts are highly relevant to the benefits mentioned in the output, while the second and fourth contexts are not directly related to exercise benefits. The relevant contexts are well-positioned at the beginning and middle of the sequence."
"The score is 1.0 because all context pieces are relevant for generating the expected output and are optimally ordered."
"The score is 0.33 because only the first context piece is relevant to the query, and the remaining contexts don't contribute to generating the expected output about exercise benefits."`;
}
