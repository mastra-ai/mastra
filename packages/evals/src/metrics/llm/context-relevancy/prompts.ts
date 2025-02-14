export const CONTEXT_RELEVANCY_AGENT_INSTRUCTIONS = `You are a balanced and nuanced context relevancy evaluator. Your job is to determine if retrieved context nodes are overall relevant to given input.

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
You should first extract statements found in the context, which are high level information found in the context, before deciding on a verdict and a reason for each statement.

Each verdict in the JSON must have:
1. 'statement': The high-level information extracted from context
2. 'verdict': STRICTLY either 'yes' or 'no'
3. 'reason': REQUIRED for ALL verdicts to explain the evaluation

For 'yes' verdicts:
- Explain how the statement helps answer or address the input
- Highlight specific relevant details or connections

For 'no' verdicts:
- Quote the irrelevant parts of the statement
- Explain why they don't help address the input

**
IMPORTANT: Please make sure to only return in JSON format.
Example Context: "Einstein won the Nobel Prize for his discovery of the photoelectric effect in 1921. He published his theory of relativity in 1905. There was a cat in his office."
Example Input: "What were some of Einstein's achievements?"

Example:
{{
    "verdicts": [
        {{
            "verdict": "yes",
            "statement": "Einstein won the Nobel Prize for his discovery of the photoelectric effect",
            "reason": "This directly addresses Einstein's achievements by highlighting a major scientific contribution that was recognized with a Nobel Prize"
        }},
        {{
            "verdict": "yes",
            "statement": "Einstein published his theory of relativity in 1905",
            "reason": "This is highly relevant as it describes one of Einstein's most significant scientific achievements and when it occurred"
        }},
        {{
            "verdict": "no",
            "statement": "There was a cat in his office",
            "reason": "The statement 'There was a cat in his office' is unrelated to Einstein's achievements. While it's a detail about his workspace, it doesn't describe any scientific or professional accomplishments"
        }}
    ]
}}
**

Input:
${input}

Output:
${output}
Context:
${context.join('\n')}
`;
}

export function generateReasonPrompt({
  score,
  input,
  irrelevancies,
  relevantStatements,
}: {
  score: number;
  input: string;
  irrelevancies: string[];
  relevantStatements: string[];
}) {
  return `Based on the given input, reasons for why the retrieval context is irrelevant to the input, the statements in the retrieval context that is actually relevant to the retrieval context, and the contextual relevancy score (the closer to 1 the better), please generate a CONCISE reason for the score.
In your reason, you should quote data provided in the reasons for irrelevancy and relevant statements to support your point.

** 
IMPORTANT: Please make sure to only return in JSON format, with the 'reason' key providing the reason.
Example JSON:
{{
    "reason": "The score is <contextual_relevancy_score> because <your_reason>."
}}

If the score is 1, keep it short and say something positive with an upbeat encouraging tone (but don't overdo it otherwise it gets annoying).
**

Contextual Relevancy Score:
${score}

Input:
${input}

Reasons for why the retrieval context is irrelevant to the input:
${irrelevancies}

Statement in the retrieval context that is relevant to the input:
${relevantStatements}`;
}
