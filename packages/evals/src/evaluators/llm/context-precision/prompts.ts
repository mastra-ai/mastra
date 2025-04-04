import type { LLMEvaluatorPromptArgs, LLMEvaluatorReasonPromptArgs } from '../types';

export const AGENT_INSTRUCTIONS = `You are a balanced and nuanced context precision evaluator. Your job is to determine if retrieved context nodes are relevant to generating the expected output.

Key Principles:
1. Evaluate whether each context node was useful in generating the expected output
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
  return `Given the input, output, and context, evaluate each context piece's relevance by generating a list of JSON objects.

**
IMPORTANT: Your response must be in JSON format with a 'outcomes' key containing a list. Each outcome must have only three   fields: \`outcome\` with either 'yes' or 'no', \`reason\` explaining the outcome, and \`claim\` with the context piece. Your reason should include relevant quotes from the context.

CRITICAL: Context should be marked as relevant if it:
1. Directly helps define or explain the subject
2. Demonstrates properties or behaviors mentioned in the output

Example Context: ["The Sun is a star", "Stars produce their own light", "The Moon reflects sunlight", "The Sun gives light to planets"]
Example Query: "What is the Sun?"
Example Expected Response: "The Sun is a star that produces light."

Consider context relevant if it:
- Directly addresses the input question
- Demonstrates properties mentioned in the output
- Provides examples that validate the output
- Contains information that helps define the subject

Mark as not relevant if the information:
- Only describes other objects' behaviors
- Has no connection to properties mentioned in output
- Is completely unrelated to the subject
- Contradicts the output

Example:
{
    "outcomes": [
        {
            "outcome": "yes",
            "reason": "The context 'The Sun is a star' directly defines what the Sun is.",
            "claim": "The Sun is a star."
        },
        {
            "outcome": "yes",
            "reason": "The context 'Stars produce their own light' is relevant as it describes a key characteristic of stars, which includes the Sun.",
            "claim": "Stars produce their own light."
        },
        {
            "outcome": "no",
            "reason": "The context 'The Moon reflects sunlight' is not relevant to defining what the Sun is or how it produces light, as it only describes how another object interacts with sunlight.",
            "claim": "The Moon reflects sunlight."
        },
        {
            "outcome": "yes",
            "reason": "The context 'The Sun gives light to planets' demonstrates the light-producing property mentioned in the output.",
            "claim": "The Sun gives light to planets."
        }
    ]  
}

Consider context relevant if it:
- Directly addresses the query
- Provides examples or instances that help explain the concept
- Offers related information that helps build understanding
- Contains partial information that contributes to the response

The number of outcomes MUST MATCH the number of context pieces exactly.
**

Input:
${input}

Output:
${output}

Number of context pieces: ${context.length === 0 ? '1' : context.length}

Context:
${context}

JSON:
`;
}

export function generateReasonPrompt({ input, output, eval_result, outcomes, settings }: LLMEvaluatorReasonPromptArgs) {
  return `Explain the context precision score where 0 is the lowest and ${settings.scale} is the highest for the LLM's response using this context:
  
  Context:
  Input: ${input}
  Output: ${output}
  Score: ${eval_result.score}
  Outcomes: ${JSON.stringify(outcomes)}
  
  Rules:
  - Explain score based on the precision of the retrieved context
  - Consider how many of the retrieved context pieces were actually relevant
  - Keep explanation concise and focused
  - Use given score, don't recalculate
  - Don't judge factual correctness
  - Explain both relevant and irrelevant aspects
  - For mixed responses, explain the balance
    Format:
    {
        "reason": "The score is {score} because {explanation of overall precision}"
    }
    Example Responses:
    {
        "reason": "The score is 0.7 because 7 out of 10 context pieces were relevant to answering the query, with most relevant pieces appearing early in the context."
    }
    {
        "reason": "The score is 0.3 because only 3 out of 10 context pieces were relevant to the query, with many irrelevant pieces mixed in."
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
