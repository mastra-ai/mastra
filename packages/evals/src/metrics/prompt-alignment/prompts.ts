export const PROMPT_ALIGNMENT_AGENT_INSTRUCTIONS = `You are a strict and thorough prompt alignment evaluator. Your job is to determine if LLM outputs follow their given prompt instructions exactly.

Key Principles:
1. Be EXTRA STRICT in your evaluation in regards to whether the instructions are followed exactly.
2. Only give a "yes" verdict if an instruction is COMPLETELY followed
3. Any partial compliance should be marked as "no"
4. Provide clear, specific reasons for any "no" verdicts
5. Focus solely on instruction compliance, not output quality
6. Judge each instruction independently. Only check if the current instruction is followed. Do not let instructions be influenced by other instructions.

Remember:
- Each instruction must be evaluated independently
- Verdicts must be either "yes" or "no" - no in-between
- Reasons are required only for "no" verdicts
- The number of verdicts must match the number of instructions exactly`;

export function generateEvaluatePrompt({
  instructions,
  input,
  output,
}: {
  instructions: string[];
  input: string;
  output: string;
}) {
  return `For the provided list of prompt instructions, determine whether each instruction has been followed in the LLM output.
Make sure to judge the output on each instruction independently. Do not let instructions be influenced by other instructions.
Generate a list of verdicts in JSON format, where each verdict must have:
- "verdict": Strictly "yes" or "no"
- "reason": Give a reason for the verdict

Be EXTRA STRICT in your evaluation. Only give "yes" if the instruction is followed COMPLETELY.
Evaluate the output EXACTLY as written - consider every character, space, and case

Example:
Input: "describe the sky"
Output: "the sky is Blue today"
Instructions: ["Start sentences with capital letters", "Use proper English"]

{
  "verdicts": [
    {
      "verdict": "no",
      "reason": "The sentence 'the sky is Blue' starts with lowercase 't'"
    },
    {
      "verdict": "no",
      "reason": "Improper capitalization: 'Blue' is capitalized mid-sentence"
    }
  ]
}

Example 2:
Input: "describe the sky"
Output: "The sky is blue today"
Instructions: ["Start sentences with capital letters", "Talk about the color black"]

{
  "verdicts": [
    {
      "verdict": "yes",
      "reason": "The output starts with a capital letter"
    },
    {
      "verdict": "no",
      "reason": "The output does not talk about the color black"
    }
  ]
}

Number of instructions: ${instructions.length}

Prompt Instructions:
${instructions}

Input:
${input}

LLM Actual Output:
${output}

JSON:`;
}

export function generateReasonPrompt({
  input,
  output,
  score,
  reasons,
  scale,
}: {
  input: string;
  output: string;
  score: number;
  reasons: string[];
  scale: number;
}) {
  return `Explain the instruction following score where 0 is the lowest and ${scale} is the highest for the LLM's response using this context:
  Context:
  Input: ${input}
  Output: ${output}
  Score: ${score}
  Failure Reasons: ${reasons.join('\n')}

  Rules (follow these rules exactly. do not deviate):
  - Keep your response concise and to the point.
  - Do not change score from what is given.
  - Do not make judgements on inputs or outputs (factual correctness, quality, etc).
  - If there are failure reasons given, explain why the score is not higher.
  

  Output format:
  {
    "reason": "The score is {score} because {explanation of instruction following}"
  }
    
  Example Responses:
  {
    "reason": "The score is ${scale} because the output follows the instructions exactly"
  }
  {
    "reason": "The score is 0 because the output does not follow the instructions"
  }
  `;
}
