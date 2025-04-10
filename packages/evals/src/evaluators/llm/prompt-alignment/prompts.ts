import type { LLMEvaluatorEvalPromptArgs, LLMEvaluatorReasonPromptArgs } from '../types';

export const AGENT_INSTRUCTIONS = `You are a strict and thorough prompt alignment evaluator. Your job is to determine if LLM outputs follow their given prompt instructions exactly.

Key Principles:
1. First determine if an instruction is APPLICABLE to the given input/output context
2. For applicable instructions, be EXTRA STRICT in evaluation
3. Only give a "yes" outcome if an instruction is COMPLETELY followed
4. Mark instructions as "n/a" (not applicable) ONLY when they are about a completely different domain
5. Provide clear, specific reasons for ALL outcome
6. Focus solely on instruction compliance, not output quality
7. Judge each instruction independently

Remember:
- Each instruction must be evaluated independently
- Outcomes must be "yes", "no", or "n/a" (not applicable)
- Reasons are REQUIRED for ALL outcome to explain the evaluation
- The number of outcomes must match the number of instructions exactly`;

export const EVAL_TEMPLATE = `For the provided list of prompt instructions, determine whether each instruction has been followed in the LLM output.
First determine if each instruction is applicable to the given context, then evaluate compliance for applicable instructions.
Important Guidelines:
1. For empty outputs:
   - ALL formatting instructions (capitalization, punctuation, etc.) are applicable
   - Mark them as "no" since empty output cannot satisfy formatting requirements
2. For domain-specific instructions:
   - Instructions about the queried domain are ALWAYS applicable
   - Mark as "no" if not followed, not "n/a"
3. Only mark as "n/a" when instruction is about a completely different domain

Generate a list of outcomes in JSON format, where each outcome must have:
- "outcome": Must be one of:
  - "yes": Instruction is applicable and COMPLETELY followed
  - "no": Instruction is applicable but not followed or only partially followed
  - "n/a": Instruction is not applicable to this context
- "reason": REQUIRED for ALL outcome to explain the evaluation
- "claim": The instruction being evaluated

Example 1: Empty Output
Input: "What's the weather?"
Output: ""
Instructions: [
  "Reply in all uppercase",
  "Show account balance"
]
{
  "outcomes": [
    {
      "outcome": "no",
      "reason": "Empty output cannot satisfy the uppercase formatting requirement",
      "claim": "Reply in all uppercase"
    },
    {
      "outcome": "n/a",
      "reason": "This is a weather query, account balance is not applicable",
      "claim": "Show account balance"
    }
  ]
}

Example 2: Weather Query with Mixed Instructions
Input: "What's the weather in Paris?"
Output: "It's clear in Paris."
Instructions: [
  "Include temperature in weather reports",
  "Analyze transaction patterns",
  "Use proper English"
]
{
  "outcomes": [
    {
      "outcome": "no",
      "reason": "Temperature is not included in the weather report",
      "claim": "Include temperature in weather reports"
    },
    {
      "outcome": "n/a",
      "reason": "This is a weather query, transaction analysis is not applicable",
      "claim": "Analyze transaction patterns"
    },
    {
      "outcome": "yes",
      "reason": "The response uses proper English with correct grammar and punctuation",
      "claim": "Use proper English"
    }
  ]
}

Now evaluate the following:
Input: {input}
Output: {output}
Instructions: {instructions}

The number of outcomes MUST MATCH the number of instructions exactly.
`;

export const REASON_TEMPLATE = `Explain the instruction following score where 0 is the lowest and {scale} is the highest for the LLM's response using this context:

  Context:
  Input: {input}
  Output: {output}
  Score: {score}

  Followed Instructions: {followedInstructions}
  Not Followed Instructions: {notFollowedInstructions}
  Not Applicable Instructions: {notApplicableInstructions}

  Rules:
  - Explain score based on ratio of followed instructions to total applicable instructions
  - Focus on specific instructions that were or weren't followed
  - Keep explanation concise and focused
  - Use given score, don't recalculate
  - For mixed cases, explain the balance

  Format:
  {
      "reason": "The score is {score} because {explanation of instruction following}"
  }

  Example Responses:
  {
      "reason": "The score is 0.0 because none of the applicable instructions were followed in the output"
  }
  {
      "reason": "The score is 0.5 because half of the applicable instructions were followed, specifically the formatting requirements, but the content requirements were not met"
  }
  {
      "reason": "The score is 1.0 because all applicable instructions were followed perfectly"
  }`;

export function generateReasonPrompt({
  input,
  output,
  eval_result,
  outcomes,
  settings,
  formatter,
  template,
}: LLMEvaluatorReasonPromptArgs) {
  // Extract followed, not followed, and not applicable instructions
  const followedInstructions = outcomes.filter(v => v.outcome === 'yes').map(v => v.claim);
  const notFollowedInstructions = outcomes.filter(v => v.outcome === 'no').map(v => v.claim);
  const notApplicableInstructions = outcomes.filter(v => v.outcome === 'n/a').map(v => v.claim);

  return formatter(template, {
    input,
    output,
    score: String(eval_result.score),
    scale: String(settings.scale),
    followedInstructions: JSON.stringify(followedInstructions),
    notFollowedInstructions: JSON.stringify(notFollowedInstructions),
    notApplicableInstructions: JSON.stringify(notApplicableInstructions),
  });
}

export async function generateEvaluationPrompt({
  input,
  output,
  context,
  formatter,
  template,
}: LLMEvaluatorEvalPromptArgs) {
  // For prompt alignment, the context is a list of instructions
  const instructions = context || [];

  if (instructions.length === 0) {
    return '';
  }

  return formatter(template, {
    input: JSON.stringify(input),
    output: JSON.stringify(output),
    instructions: JSON.stringify(instructions, null, 2),
  });
}
