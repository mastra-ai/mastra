export const CONTEXT_POSITION_AGENT_INSTRUCTIONS = `You are a balanced and nuanced context position evaluator. Your job is to determine if retrieved context nodes are relevant to generating the expected output, with special attention to their ordering.

Key Principles:
1. Evaluate whether each context node contributes to understanding the expected output - both directly AND indirectly
2. Consider all forms of relevance:
   - Direct definitions or explanations
   - Supporting evidence or examples
   - Related characteristics or behaviors
   - Real-world applications or effects
3. Pay attention to the position of relevant information
4. Recognize that earlier positions should contain more relevant information
5. Be inclusive rather than exclusive in determining relevance - if the information supports or reinforces the output in any way, consider it relevant
6. Empty or error nodes should be marked as not relevant`;

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
IMPORTANT: Your response must be in JSON format with a 'verdicts' key containing a list. Each verdict must have only two fields: \`verdict\` with either 'yes' or 'no', and \`reason\` explaining the verdict. Your reason should include relevant quotes from the context.

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
    "verdicts": [
        {
            "verdict": "yes",
            "reason": "The context 'The Sun is a star' directly defines what the Sun is."
        },
        {
            "verdict": "yes",
            "reason": "The context 'Stars produce their own light' is relevant as it describes a key characteristic of stars, which includes the Sun."
        },
        {
            "verdict": "no",
            "reason": "The context 'The Moon reflects sunlight' is not relevant to defining what the Sun is or how it produces light, as it only describes how another object interacts with sunlight."
        },
        {
            "verdict": "yes",
            "reason": "The context 'The Sun gives light to planets' demonstrates the light-producing property mentioned in the output."
        }
    ]  
}

Consider context relevant if it:
- Directly addresses the query
- Provides examples or instances that help explain the concept
- Offers related information that helps build understanding
- Contains partial information that contributes to the response

The number of verdicts MUST MATCH the number of context pieces exactly.
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

export function generateReasonPrompt({
  score,
  verdicts,
  input,
  output,
  scale,
}: {
  score: number;
  verdicts: { verdict: string; reason: string }[];
  input: string;
  output: string;
  scale: number;
}) {
  return `Explain the irrelevancy score where 0 is the lowest and ${scale} is the highest for the LLM's response using this context:
  Context:
  Input: ${input}
  Output: ${output}
  Score: ${score}
  Verdicts: ${JSON.stringify(verdicts)}
  
  Rules:
  - Explain score based on mix of direct answers and related context
  - Consider both full and partial relevance
  - Keep explanation concise and focused
  - Use given score, don't recalculate
  - Don't judge factual correctness
  - Explain both relevant and irrelevant aspects
  - For mixed responses, explain the balance
    Format:
    {
        "reason": "The score is {score} because {explanation of overall relevance}"
    }
    Example Responses:
    {
        "reason": "The score is 7 because while the first statement directly answers the question, the additional context is only partially relevant"
    }
    {
        "reason": "The score is 3 because while the answer discusses the right topic, it doesn't directly address the question"
    }
    `;
}
