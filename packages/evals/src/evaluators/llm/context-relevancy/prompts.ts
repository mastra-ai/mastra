import type { LLMEvaluatorPromptArgs, LLMEvaluatorReasonPromptArgs } from '../types';

export const AGENT_INSTRUCTIONS = `You are a balanced and nuanced context relevancy evaluator. Your job is to determine if retrieved context nodes are overall relevant to given input.

Key Principles:
1. Evaluate whether each context node was useful in generating the given input
2. Consider all forms of relevance:
   - Direct definitions or explanations
   - Supporting evidence or examples
   - Related characteristics or behaviors
   - Real-world applications or effects
3. Prioritize usefulness over completeness
4. Recognize that some nodes may be partially relevant
5. Empty or error nodes should be marked as not relevant`;

export function generateEvaluatePrompt({
  input,
  output,
  context,
}: {
  input: string;
  output: string;
  context: string[];
}) {
  return `Based on the input and context, please generate a JSON object to indicate whether each statement found in the context is relevant to the provided input. First extract high-level statements from the context, then evaluate each for relevance.
You should first extract statements found in the context, which are high level information found in the context, before deciding on a outcome, reason, and claim for each statement.

Each outcome in the JSON must have:
1. 'claim': The high-level information extracted from context
2. 'outcome': STRICTLY either 'yes' or 'no'
3. 'reason': REQUIRED for ALL outcomes to explain the evaluation

For 'yes' outcomes:
- Explain how the statement helps answer or address the input
- Highlight specific relevant details or connections

For 'no' outcomes:
- Quote the irrelevant parts of the statement
- Explain why they don't help address the input

**
IMPORTANT: Please make sure to only return in JSON format.
Example Context: "Einstein won the Nobel Prize for his discovery of the photoelectric effect in 1921. He published his theory of relativity in 1905. There was a cat in his office."
Example Input: "What were some of Einstein's achievements?"

Example:
{
    "outcomes": [
        {
            "outcome": "yes",
            "claim": "Einstein won the Nobel Prize for his discovery of the photoelectric effect",
            "reason": "This directly addresses Einstein's achievements by highlighting a major scientific contribution that was recognized with a Nobel Prize"
        },
        {
            "outcome": "yes",
            "claim": "He published his theory of relativity in 1905",
            "reason": "This is relevant as it mentions another significant achievement of Einstein, which directly addresses the question about his accomplishments"
        },
        {
            "outcome": "no",
            "claim": "There was a cat in his office",
            "reason": "This statement about a cat in Einstein's office is not relevant to his achievements as it doesn't describe any scientific or professional accomplishment"
        }
    ]
}
**

Input:
${input}

Output:
${output}

Context:
${context}

JSON:
`;
}

export function generateReasonPrompt({ input, output, eval_result, outcomes, settings }: LLMEvaluatorReasonPromptArgs) {
  // Extract relevant and irrelevant statements from outcomes
  const relevantStatements = outcomes.filter(v => v.outcome.toLowerCase() === 'yes').map(v => v.reason);

  const irrelevancies = outcomes.filter(v => v.outcome.toLowerCase() === 'no').map(v => v.reason);

  return `Explain the context relevancy score where 0 is the lowest and ${settings.scale} is the highest for the LLM's response using this context:
  
  Context:
  Input: ${input}
  Output: ${output}
  Score: ${eval_result?.score}
  
  Relevant statements:
  ${relevantStatements.length > 0 ? relevantStatements.join('\n') : 'None'}
  
  Irrelevant statements:
  ${irrelevancies.length > 0 ? irrelevancies.join('\n') : 'None'}
  
  Rules:
  - Explain score based on the relevance of the retrieved context to the input
  - Consider how many of the retrieved context pieces were actually relevant
  - Keep explanation concise and focused
  - Use given score, don't recalculate
  - Don't judge factual correctness
  - Explain both relevant and irrelevant aspects
  - For mixed responses, explain the balance
    Format:
    {
        "reason": "The score is {score} because {explanation of overall relevancy}"
    }
    Example Responses:
    {
        "reason": "The score is 0.7 because 7 out of 10 context pieces were relevant to the input query, providing useful information that directly addressed the question."
    }
    {
        "reason": "The score is 0.3 because only 3 out of 10 context pieces were relevant to the input query, with many irrelevant pieces that didn't help answer the question."
    }
    `;
}

export async function generateEvaluationPrompt({ input, output, context }: LLMEvaluatorPromptArgs) {
  const prompt = generateEvaluatePrompt({
    input,
    output,
    context: context || [],
  });

  return prompt;
}
