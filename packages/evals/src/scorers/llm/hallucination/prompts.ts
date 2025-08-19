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
10. Subjective claims ("made history", "pioneering", "leading") are hallucinations unless explicitly stated in context
`;

export function createHallucinationExtractPrompt({ output }: { output: string }) {
  return `Extract all claims from the given output. A claim is any statement that asserts information, including both factual and speculative assertions.

Guidelines for claim extraction:
- Break down compound statements into individual claims
- Include all statements that assert information
- Include both definitive and speculative claims (using words like may, might, could)
- Extract specific details like numbers, dates, and quantities
- Keep relationships between entities
- Include predictions and possibilities
- Extract claims with their full context
- Exclude only questions and commands

===== Example =====
Example:
Text: "The Tesla Model S was launched in 2012 and has a range of 405 miles. The car can accelerate from 0 to 60 mph in 1.99 seconds. I think it might be the best electric car ever made and could receive major updates next year."

{
    "claims": [
        "The Tesla Model S was launched in 2012",
        "The Tesla Model S has a range of 405 miles",
        "The Tesla Model S can accelerate from 0 to 60 mph in 1.99 seconds",
        "The Tesla Model S might be the best electric car ever made",
        "The Tesla Model S could receive major updates next year"
    ]
}
Note: All assertions are included, even speculative ones, as they need to be verified against the context.

===== END OF EXAMPLE ======
Please return only JSON format with "claims" array.
Return empty list for empty OUTPUT.

Output:
===== OUTPUT =====

${output}

===== END OF OUTPUT =====

# Important Instructions
- If the output above is empty (contains no text), you MUST return exactly this JSON: {"claims": []}
- Only extract claims if there is actual text in the output section

JSON:
`;
}

export function createHallucinationAnalyzePrompt({ context, claims }: { context: string[]; claims: string[] }) {
  return `Verify if the claims contain any information not supported by or contradicting the provided context. A hallucination occurs when a claim either:
1. Contradicts the context
2. Makes assertions not supported by the context

Claims to verify:
${claims.join('\n')}

Number of claims: ${claims.length}

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

=== Example ===
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
- Every factual claim must be verified
- Never use prior knowledge in your judgment
- Provide clear reasoning for each verdict
- Be specific about what information is or isn't supported by context
- Allow reasonable approximations and less precise dates

Format:
{
    "verdicts": [
        {
            "statement": "individual claim",
            "verdict": "yes/no",
            "reason": "explanation of whether the claim is supported by context"
        }
    ]
}

If there are no claims, return an empty array for verdicts.
`;
}

export function createHallucinationReasonPrompt({
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
  "The score is {score} because {explanation of hallucination}"

  Example Responses:
  "The score is 0.0 because none of the statements from the context were contradicted by the output"
  "The score is 0.5 because half of the statements from the context were directly contradicted by claims in the output"
  `;
}
