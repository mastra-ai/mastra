export const CONTEXT_RECALL_AGENT_INSTRUCTIONS = `You are a balanced and nuanced contextual recall evaluator. Your job is to determine if retrieved context nodes are aligning to the expected output.`;

export function generateEvaluatePrompt({
  input,
  output,
  context,
}: {
  input: string;
  output: string;
  context: string[];
}) {
  return `For EACH context node provided below, determine whether the information in that node was used in the given output. Please generate a list of JSON with two keys: \`verdict\` and \`reason\`.
The "verdict" key should STRICTLY be either a 'yes' or 'no'. Answer 'yes' if the context node was used in the output, else answer 'no'.
The "reason" key should provide a brief explanation for the verdict. If the context was used, quote the specific part of the output that relates to this context node, keeping it concise and using an ellipsis if needed.

**
IMPORTANT: Please make sure to only return in JSON format, with the 'verdicts' key as a list of JSON objects, each with two keys: \`verdict\` and \`reason\`.

{{
    "verdicts": [
        {{
            "verdict": "yes",
            "reason": "..."
        }},
        ...
    ]  
}}

The number of 'verdicts' SHOULD BE STRICTLY EQUAL to the number of context nodes provided.
**

input:
${input}

Output to evaluate:
${output}

Context Nodes:
${context.map((node, i) => `--- Node ${i + 1} ---\n${node}`).join('\n\n')}
`;
}

export function generateReasonPrompt({
  score,
  unsupportiveReasons,
  expectedOutput,
  supportiveReasons,
}: {
  score: number;
  unsupportiveReasons: string[];
  expectedOutput: string;
  supportiveReasons: string[];
}) {
  return `Given the original expected output, a list of supportive reasons, and a list of unsupportive reasons (which is deduced directly from the 'expected output'), and a contextual recall score (closer to 1 the better), summarize a CONCISE reason for the score.
A supportive reason is the reason why a certain sentence in the original expected output can be attributed to the node in the retrieval context.
An unsupportive reason is the reason why a certain sentence in the original expected output cannot be attributed to anything in the retrieval context.
In your reason, you should related supportive/unsupportive reasons to the sentence number in expected output, and info regarding the node number in retrieval context to support your final reason. The first mention of "node(s)" should specify "node(s) in retrieval context)".

**
IMPORTANT: Please make sure to only return in JSON format, with the 'reason' key providing the reason.
Example JSON:
{{
    "reason": "The score is <contextual_recall_score> because <your_reason>."
}}

DO NOT mention 'supportive reasons' and 'unsupportive reasons' in your reason, these terms are just here for you to understand the broader scope of things.
If the score is 1, keep it short and say something positive with an upbeat encouraging tone (but don't overdo it otherwise it gets annoying).
**

Contextual Recall Score:
${score}

Expected Output:
${expectedOutput}

Supportive Reasons:
${supportiveReasons.join('\n')}

Unsupportive Reasons:
${unsupportiveReasons.join('\n')}
`;
}
