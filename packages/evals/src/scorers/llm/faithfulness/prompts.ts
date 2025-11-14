export const FAITHFULNESS_AGENT_INSTRUCTIONS = `You are a precise and thorough faithfulness evaluator. Your job is to determine if LLM outputs are factually consistent with the provided context, focusing on claim verification.

Key Principles:
1. First extract all claims from the output (both factual and speculative)
2. Then verify each extracted claim against the provided context
3. Consider a claim truthful if it is explicitly supported by the context
4. Consider a claim contradictory if it directly conflicts with the context
5. Consider a claim unsure if it is not mentioned in the context
6. Empty outputs should be handled as having no claims
7. Focus on factual consistency, not relevance or completeness
8. Never use prior knowledge in judgments
9. Claims with speculative language (may, might, possibly) should be marked as "unsure"`;

export function createFaithfulnessExtractPrompt({ output }: { output: string }) {
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

Please return only JSON format with "claims" array.
Return empty list for empty input.

Text:
${output}

JSON:
`;
}

export function createFaithfulnessAnalyzePrompt({ claims, context }: { claims: string[]; context: string[] }) {
  return `Verify each claim against the provided context. Determine if each claim is supported by, contradicts, or is not mentioned in the context.

Context:
${context.join('\n')}

Number of claims: ${claims.length}

Claims to verify:
${claims.join('\n')}

For each claim, provide a verdict and reasoning. The verdict must be one of:
- "yes" if the claim is supported by the context
- "no" if the claim directly contradicts the context
- "unsure" if the claim is not mentioned in the context or cannot be verified

The number of verdicts MUST MATCH the number of claims exactly.

Format:
{
    "verdicts": [
        {
            "claim": "claim text",
            "verdict": "yes/no/unsure",
            "reason": "explanation of verification"
        }
    ]
}

Rules:
- Only use information from the provided context
- Mark claims as "no" ONLY if they directly contradict the context
- Mark claims as "yes" if they are explicitly supported by the context
- Mark claims as "unsure" if they are not mentioned in the context
- Claims with speculative language (may, might, possibly) should be marked as "unsure"
- Never use prior knowledge in your judgment
- Provide clear reasoning for each verdict
- Be specific about where in the context the claim is supported or contradicted

Example:
Context: "The Tesla Model S was launched in 2012. The car has a maximum range of 375 miles and comes with advanced autopilot features."
Claims: ["The Tesla Model S was launched in 2012", "The Tesla Model S has a range of 405 miles", "The car might get software updates"]
{
    "verdicts": [
        {
            "claim": "The Tesla Model S was launched in 2012",
            "verdict": "yes",
            "reason": "This is explicitly stated in the context"
        },
        {
            "claim": "The Tesla Model S has a range of 405 miles",
            "verdict": "no",
            "reason": "The context states the maximum range is 375 miles, contradicting the claim of 405 miles"
        },
        {
            "claim": "The car might get software updates",
            "verdict": "unsure",
            "reason": "This is speculative and not mentioned in the context"
        }
    ]
}`;
}

export function createFaithfulnessReasonPrompt({
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
  return `Explain the faithfulness score 0 is the lowest and ${scale} is the highest for the LLM's response using this context:

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
- Explain score based on ratio of supported claims ("yes" verdicts) to total claims
- Focus on factual consistency with context
- Keep explanation concise and focused
- Use given score, don't recalculate
- Explain both supported and contradicted aspects
- For mixed cases, explain the balance
- If no contradictions, use a positive but professional tone
- Base explanation only on the verified claims, not prior knowledge

Format:
"The score is {score} because {explanation of faithfulness}"

Example Responses:
"The score is 1.0 because all claims made in the output are supported by the provided context"
"The score is 0.5 because while half of the claims are supported by the context, the remaining claims either contradict the context or cannot be verified"
}`;
}
