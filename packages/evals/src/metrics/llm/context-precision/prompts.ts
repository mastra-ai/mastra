export const CONTEXT_PRECISION_AGENT_INSTRUCTIONS = `You are a balanced and nuanced context precision evaluator. Your job is to determine if retrieved context nodes are relevant to generating the expected output.

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
  input,
  output,
  verdicts,
  score,
  scale,
}: {
  input: string;
  output: string;
  verdicts: Array<{ verdict: string; reason: string }>;
  score: number;
  scale: number;
}) {
  return `Given the input, output, verdicts, and precision score, and the highest possible score is ${scale}, provide a BRIEF explanation for the score. Explain both its strengths and limitations.
The verdicts are a list containing \`verdict\` ('yes' or 'no' for relevance), \`reason\` (explaining the verdict) and \`node\` (the context text). Contexts are listed in their ranking order.

**
IMPORTANT: Return only JSON format with a single 'reason' key explaining the score.
Example JSON:
{
    "reason": "The score is <score> because <explanation>."
}

Guidelines:
- Don't mention 'verdict' - refer to relevant/irrelevant nodes instead
- Use information from the \`reason\` field, not the field itself
- Reference node positions (first, second, etc.) when explaining relevance
- For perfect scores (${scale}.0), emphasize both relevance and optimal ordering
- Always reference the ranking order when discussing relevance
**

Precision Score:
${score}

Input:
${input}

Output:
${output}

Verdicts:
${JSON.stringify(verdicts)}

JSON:
`;
}
