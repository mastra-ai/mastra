export const PROMPT_ALIGNMENT_AGENT_INSTRUCTIONS = `You are a strict and thorough prompt alignment evaluator. Your job is to determine if LLM outputs follow their given prompt instructions exactly.

Key Principles:
1. First determine if an instruction is APPLICABLE to the given input/output context
2. For applicable instructions, be EXTRA STRICT in evaluation
3. Only give a "yes" verdict if an instruction is COMPLETELY followed
4. Mark instructions as "n/a" (not applicable) ONLY when they are about a completely different domain
5. Provide clear, specific reasons for ALL verdicts
6. Focus solely on instruction compliance, not output quality
7. Judge each instruction independently

Remember:
- Each instruction must be evaluated independently
- Verdicts must be "yes", "no", or "n/a" (not applicable)
- Reasons are REQUIRED for ALL verdicts to explain the evaluation
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
First determine if each instruction is applicable to the given context, then evaluate compliance for applicable instructions.
Important Guidelines:
1. For empty outputs:
   - ALL formatting instructions (capitalization, punctuation, etc.) are applicable
   - Mark them as "no" since empty output cannot satisfy formatting requirements
2. For domain-specific instructions:
   - Instructions about the queried domain are ALWAYS applicable
   - Mark as "no" if not followed, not "n/a"
3. Only mark as "n/a" when instruction is about a completely different domain

Generate a list of verdicts in JSON format, where each verdict must have:
- "verdict": Must be one of:
  - "yes": Instruction is applicable and COMPLETELY followed
  - "no": Instruction is applicable but not followed or only partially followed
  - "n/a": Instruction is not applicable to this context
- "reason": REQUIRED for ALL verdicts to explain the evaluation

Example 1: Empty Output
Input: "What's the weather?"
Output: ""
Instructions: [
  "Reply in all uppercase",
  "Show account balance"
]
{
  "verdicts": [
    {
      "verdict": "no",
      "reason": "Empty output cannot satisfy the uppercase formatting requirement"
    },
    {
      "verdict": "n/a",
      "reason": "This is a weather query, account balance is not applicable"
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
  "verdicts": [
    {
      "verdict": "no",
      "reason": "Temperature is not included in the weather report"
    },
    {
      "verdict": "n/a",
      "reason": "This is a weather query, transaction analysis is not applicable"
    },
    {
      "verdict": "yes",
      "reason": "The response uses proper English with correct grammar and punctuation"
    }
  ]
}

Example 3: Weather Query with Multiple Requirements
Input: "What's the weather in Paris?"
Output: "The temperature is 22°C in Paris"
Instructions: [
  "Include temperature in weather reports",
  "Mention wind conditions",
  "End with a period"
]
{
  "verdicts": [
    {
      "verdict": "yes",
      "reason": "Temperature (22°C) is included in the report"
    },
    {
      "verdict": "no",
      "reason": "Wind conditions are not mentioned in the weather report"
    },
    {
      "verdict": "no",
      "reason": "The response does not end with a period"
    }
  ]
}

Now evaluate the following:
Input: ${JSON.stringify(input)}
Output: ${JSON.stringify(output)}
Instructions: ${JSON.stringify(instructions, null, 2)}

{
  "verdicts": [
    {
      "verdict": "no",
      "reason": "Temperature is not included in the weather report"
    },
    {
      "verdict": "n/a",
      "reason": "This is a weather query, transaction analysis is not applicable"
    },
    {
      "verdict": "yes",
      "reason": "Response uses proper English with correct grammar and punctuation"
    }
  ]
}

Example 2: Transaction Query with Incomplete Analysis
Input: "Review my recent spending"
Output: "You spent money this month."
Instructions: [
  "Include temperature in weather reports",
  "Analyze transaction patterns",
  "Use proper English",
  "Provide specific insights"
]

{
  "verdicts": [
    {
      "verdict": "n/a",
      "reason": "This is a transaction query, weather information is not applicable"
    },
    {
      "verdict": "no",
      "reason": "No analysis of patterns or trends is provided, just a basic statement"
    },
    {
      "verdict": "yes",
      "reason": "Response uses correct English grammar and structure"
    },
    {
      "verdict": "no",
      "reason": "Response lacks specific details or actionable insights about spending"
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
  verdicts,
  scale,
}: {
  input: string;
  output: string;
  score: number;
  verdicts: { verdict: string; reason: string }[];
  scale: number;
}) {
  return `Explain the instruction following score where 0 is the lowest and ${scale} is the highest for the LLM's response using this context:
  Context:
  Input: ${input}
  Output: ${output}
  Score: ${score}
  Verdicts: ${JSON.stringify(verdicts)}

  Rules (follow these rules exactly. do not deviate):
  - Keep your response concise and to the point
  - Do not change score from what is given
  - Do not make judgements on inputs or outputs (factual correctness, quality, etc)
  - Focus on how well the output aligns with the given instructions
  - Explain what aspects of instruction alignment affected the score
  - Do not reference the verdicts themselves in your explanation


  Output format:
  {
    "reason": "The score is {score} because {explanation of instruction following}"
  }
    
  Example Responses:
  {
    "reason": "The score is ${scale} because the output fully aligns with all applicable instructions, providing clear and actionable information while maintaining a professional tone"
  }
  {
    "reason": "The score is 0 because the output does not follow the instructions"
  }
  `;
}
