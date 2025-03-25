export const HALLUCINATION_AGENT_INSTRUCTIONS = `You are a precise and thorough hallucination evaluator. Your job is to determine if an LLM's output contains information not supported by or contradicts the provided context.

Key Principles:
1. First extract all claims from the output (both factual and speculative)
2. Then verify each extracted claim against the provided context
3. Consider it a hallucination if a claim contradicts the context
4. Consider it a hallucination if a claim makes assertions not supported by context
5. Empty outputs should be handled as having no hallucinations
6. Speculative language (may, might, possibly) about facts IN the context is NOT a hallucination
7. Speculative language about facts NOT in the context IS a hallucination
8. Never use prior knowledge in judgments - only use what's explicitly stated in context
9. The following are NOT hallucinations:
   - Using less precise dates (e.g., year when context gives month)
   - Reasonable numerical approximations
   - Omitting additional details while maintaining factual accuracy
10. Subjective claims ("made history", "pioneering", "leading") are hallucinations unless explicitly stated in context`;

export function generateEvaluatePrompt({ context, claims }: { context: string[]; claims: string[] }) {
  return `Verify if the claims contain any information not supported by or contradicting the provided context. A hallucination occurs when a claim either:
1. Contradicts the context
2. Makes assertions not supported by the context

Claims to verify:
${claims.join('\n')}

Number of context statements: ${context.length}

Context statements:
${context.join('\n')}

For each claim, determine if it is supported by the context. When evaluating:

1. NOT Hallucinations:
   - Using less precise dates (e.g., year when context gives month)
   - Reasonable numerical approximations
   - Omitting additional details while maintaining factual accuracy
   - Speculative language about facts present in context

2. ARE Hallucinations:
   - Claims that contradict the context
   - Assertions not supported by context
   - Speculative claims about facts not in context
   - Subjective claims not explicitly supported by context

Example:
Context: [
  "SpaceX achieved first successful landing in December 2015.",
  "Their reusable rocket technology reduced launch costs by 30%."
]
Claims: [
  "SpaceX made history in 2015",
  "SpaceX had pioneering reusable rockets",
  "reusable rockets significantly cut costs",
  "They might expand operations globally"
]
{
    "verdicts": [
        {
            "statement": "SpaceX made history in 2015",
            "verdict": "yes",
            "reason": "The subjective claim 'made history' and the year are not supported by context"
        },
        {
            "statement": "SpaceX had pioneering reusable rockets",
            "verdict": "yes",
            "reason": "The subjective claim 'pioneering' is not supported by context"
        },
        {
            "statement": "reusable rockets significantly cut costs",
            "verdict": "no",
            "reason": "Context supports that costs were reduced by 30%, this is a reasonable paraphrase"
        },
        {
            "statement": "They might expand operations globally",
            "verdict": "yes",
            "reason": "This speculative claim about facts not in context is a hallucination"
        }
    ]
}

Rules:
- Mark as hallucination if information contradicts context
- Mark as hallucination if assertions aren't supported by context
- Allow reasonable approximations and less precise dates
- Every factual claim must be verified
- Never use prior knowledge in your judgment
- Provide clear reasoning for each verdict
- Be specific about what information is or isn't supported by context

Format:
{
    "verdicts": [
        {
            "statement": "individual claim",
            "verdict": "yes/no",
            "reason": "explanation of whether the claim is supported by context"
        }
    ]
}`;
}

export function generateReasonPrompt({
  input,
  output,
  context,
  score,
  scale,
  verdicts,
}: {
  input: string;
  output: string;
  context: string[];
  score: number;
  scale: number;
  verdicts: { verdict: string; reason: string }[];
}) {
  return `Explain the hallucination score where 0 is the lowest and ${scale} is the highest for the LLM's response using this context:
  Context:
  ${context.join('\n')}
  Input:
  ${input}
  Output:
  ${output}
  Score: ${score}
  Verdicts:
  ${JSON.stringify(verdicts)}
  Rules:
  - Explain score based on ratio of contradicted statements to total statements
  - Focus on factual inconsistencies with context
  - Keep explanation concise and focused
  - Use given score, don't recalculate
  - Explain both contradicted and non-contradicted aspects
  - For mixed cases, explain the balance
  - Base explanation only on the verified statements, not prior knowledge
  Format:
  {
      "reason": "The score is {score} because {explanation of hallucination}"
  }
  Example Responses:
  {
      "reason": "The score is 0.0 because none of the statements from the context were contradicted by the output"
  }
  {
      "reason": "The score is 0.5 because half of the statements from the context were directly contradicted by claims in the output"
  }`;
}
