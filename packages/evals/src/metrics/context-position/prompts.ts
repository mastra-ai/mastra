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

Example Context: ["The Sun is a star", "Stars produce their own light", "The Moon reflects sunlight"]
Example Query: "What is the Sun?"
Example Expected Response: "The Sun is a star that produces light."

Consider context relevant if it:
- Directly addresses the input
- Provides examples or instances that help explain the concept
- Offers related information that helps build understanding
- Contains partial information that contributes to the response
- Demonstrates or validates characteristics mentioned in the output
- Shows real-world applications or effects of the concept
- Reinforces or provides evidence for any part of the output
- Helps establish credibility or understanding of the subject
- Describes the actions the subject can perform

A context piece should be considered relevant if it contributes ANY supporting information or evidence, even if indirect.

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
            "reason": "The context 'The Moon reflects sunlight' is not relevant to defining what the Sun is."
        }
    ]  
}

The number of verdicts MUST MATCH the number of context pieces exactly.
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

export function generateReasonPrompt({
  input,
  output,
  verdicts,
  score,
}: {
  input: string;
  output: string;
  verdicts: Array<{ verdict: string; reason: string }>;
  score: number;
}) {
  return `Given the input, output, verdicts, and position score, provide a BRIEF explanation for the score. Focus on both relevance and positioning of the context.
  The retrieved contexts is a list containing \`verdict\` ('yes' or 'no' for relevance), \`reason\` (explaining the verdict) and \`node\` (the context text). Contexts are listed in their ranking order.

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
- For perfect scores (10.0), emphasize both relevance and optimal ordering
- Always reference the ranking order when discussing relevance
**

Position Score:
${score}

Input:
${input}

Output:
${output}

Context:
${verdicts}

JSON:
`;
}
