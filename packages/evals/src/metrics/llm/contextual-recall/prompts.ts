export const CONTEXT_POSITION_AGENT_INSTRUCTIONS = `You are a balanced and nuanced contextual recall evaluator. Your job is to determine if retrieved context nodes are aligning to the expected output.`;

export function generateEvaluatePrompt({
  input,
  output,
  context,
}: {
  input: string;
  output: string;
  context: string[];
}) {
  return `For EACH sentence in the given expected output below, determine whether the sentence can be attributed to the nodes of retrieval contexts. Please generate a list of JSON with two keys: \`verdict\` and \`reason\`.
The "verdict" key should STRICTLY be either a 'yes' or 'no'. Answer 'yes' if the sentence can be attributed to any parts of the retrieval context, else answer 'no'.
The "reason" key should provide a reason why to the verdict. In the reason, you should aim to include the node(s) count in the retrieval context (eg., 1st node, and 2nd node in the retrieval context) that is attributed to said sentence. You should also aim to quote the specific part of the retrieval context to justify your verdict, but keep it extremely concise and cut short the quote with an ellipsis if possible. 

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

Since you are going to generate a verdict for each sentence, the number of 'verdicts' SHOULD BE STRICTLY EQUAL to the number of sentences in of \`expected output\`.
**

input:
${input}

Expected Output:
${output}

Retrieval Context:
${context}
`;
}
