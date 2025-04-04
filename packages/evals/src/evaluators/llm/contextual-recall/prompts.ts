import type { LLMEvaluatorPromptArgs, LLMEvaluatorReasonPromptArgs } from '../types';

export const AGENT_INSTRUCTIONS = `You are a balanced and nuanced contextual recall evaluator. Your job is to determine if retrieved context nodes are aligning to the expected output.`;

export function generateEvaluatePrompt({
  input,
  output,
  context,
}: {
  input: string;
  output: string;
  context: string[];
}) {
  return `For EACH sentence in the given expected output below, determine whether the sentence can be attributed to the nodes of retrieval contexts. Please generate a list of JSON with three keys: \`outcome\`, \`reason\` and \`claim\`.
The "outcome" key should STRICTLY be either a 'yes' or 'no'. Answer 'yes' if the sentence can be attributed to any parts of the retrieval context, else answer 'no'.
The "reason" key should provide a reason why to the outcome. In the reason, you should aim to include the node(s) count in the retrieval context (eg., 1st node, and 2nd node in the retrieval context) that is attributed to said sentence. You should also aim to quote the specific part of the retrieval context to justify your outcome, but keep it extremely concise and cut short the quote with an ellipsis if possible. 

**
IMPORTANT: Please make sure to only return in JSON format, with the 'outcomes' key as a list of JSON objects, each with three keys: \`claim\`, \`outcome\` and \`reason\`.

{
    "outcomes": [
        {
            "claim": "...",
            "reason": "...",
            "outcome": "..."
        },
        ...
    ]  
}

Since you are going to generate a outcome for each sentence, the number of 'outcomes' SHOULD BE STRICTLY EQUAL to the number of sentences in of \`expected output\`.
**

input:
${input}

Expected Output:
${output}

Retrieval Context:
${context}
`;
}

export function generateReasonPrompt({ output, eval_result, outcomes, settings }: LLMEvaluatorReasonPromptArgs) {
  // Extract supportive and unsupportive reasons from outcomes
  const supportiveReasons = outcomes.filter(v => v.outcome === 'yes').map(v => v.reason);

  const unsupportiveReasons = outcomes.filter(v => v.outcome === 'no').map(v => v.reason);

  return `Explain the contextual recall score where 0 is the lowest and ${settings.scale} is the highest:
  
  Expected Output:
  ${output}
  
  Score: ${eval_result?.score}
  
  Supportive Reasons:
  ${supportiveReasons.length > 0 ? supportiveReasons.join('\n') : 'None'}
  
  Unsupportive Reasons:
  ${unsupportiveReasons.length > 0 ? unsupportiveReasons.join('\n') : 'None'}
  
  Rules:
  - Explain score based on how much of the output is supported by the context
  - Keep explanation concise and focused
  - Use given score, don't recalculate
  - Explain both supported and unsupported aspects
  - For mixed responses, explain the balance
  
  Format:
  {
      "reason": "The score is {score} because {explanation of overall recall}"
  }
  
  Example Responses:
  {
      "reason": "The score is 0.8 because 4 out of 5 sentences in the output are directly supported by the context, with only one sentence lacking clear evidence in the provided context."
  }
  {
      "reason": "The score is 0.0 because none of the sentences in the output are supported by the context, indicating a complete lack of contextual recall."
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
