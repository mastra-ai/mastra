import { z } from 'zod';
import type { LLMEvaluatorPromptArgs, LLMEvaluatorReasonPromptArgs } from '../types';

export const AGENT_INSTRUCTIONS = `You are a precise and thorough faithfulness evaluator. Your job is to determine if LLM outputs are factually consistent with the provided context, focusing on claim verification.

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

export function generateClaimExtractionPrompt({ output }: { output: string }) {
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

export function generateEvaluatePrompt({ claims, context }: { claims: string[]; context: string[] }) {
  return `For each claim, determine if it is supported by the provided context. Generate a list of JSON objects with three keys: \`claim\`, \`outcome\`, and \`reason\`.

For the \`outcome\` key, use ONLY one of these values:
- "yes" - The claim is explicitly supported by the context
- "no" - The claim contradicts the context
- "unsure" - The claim is neither supported nor contradicted by the context

For the \`reason\` key, provide a brief explanation for your outcome. Include specific quotes from the context that support or contradict the claim.

For the \`claim\` key, use the claim from the \`claims\` array.

**
IMPORTANT: Please make sure to only return in JSON format.

Example:
{
    "outcomes": [
        {
            "claim": "The Earth orbits around the Sun",
            "outcome": "yes",
            "reason": "The context explicitly states 'The Earth completes one orbit around the Sun every 365.25 days.'"
        },
        {
            "claim": "Mars has three moons",
            "outcome": "no",
            "reason": "The context contradicts this by stating 'Mars has two moons: Phobos and Deimos.'"
        },
        {
            "claim": "Venus might have had oceans in the past",
            "outcome": "unsure",
            "reason": "The context doesn't mention anything about Venus having oceans in the past."
        }
    ]
}

Additional examples of correct evaluations:

1. Time period interpretation:
Context: "John Smith has been CEO since 2020."
Claim: "John Smith has been leading the company for several years."
Correct outcome: "yes" (Since 2020 implies several years of leadership)

2. Approximate numbers:
Context: "The company has approximately 500 employees."
Claim: "The company employs around 480-520 people."
Correct outcome: "yes" (This range is within a reasonable interpretation of "approximately 500")

3. Precise numbers vs. approximations:
Context: "The company has approximately 500 employees."
Claim: "The company employs exactly 498 people."
Correct outcome: "unsure" (The context only provides an approximation, not a precise count)

4. Reasonable inference:
Context: "The company expanded operations to 5 new countries in Asia last year."
Claim: "The company has an international presence."
Correct outcome: "yes" (Having operations in multiple countries implies international presence)

IMPORTANT GUIDELINES:
1. Be charitable in your interpretation - if a claim is reasonably implied by the context, mark it as "yes" even if the exact wording differs.
2. For time periods, be flexible - "several years" can reasonably mean 3+ years, "recently" can mean within the last few years, etc.
3. For approximate numbers:
   - When context uses approximations (like "about", "approximately", "around"), and the claim uses similar approximations within a reasonable range, mark as "yes"
   - When context uses approximations but the claim states a precise number (e.g., "exactly 498" vs "approximately 500"), mark as "unsure"
   - When context gives a precise number but the claim uses a different precise number, mark as "no"
4. For subjective claims that can be reasonably inferred from objective facts in the context, mark as "yes".
5. Only mark claims as "no" if they clearly contradict the context.
**

Claims:
${claims.map((claim, i) => `${i + 1}. ${claim}`).join('\n')}

Context:
${context.map((c, i) => `${i + 1}. ${c}`).join('\n')}`;
}

export function generateReasonPrompt({
  input,
  output,
  context,
  eval_result,
  settings,
  outcomes,
}: LLMEvaluatorReasonPromptArgs) {
  // Filter outcomes by type
  const supportedClaims = outcomes.filter(v => v.outcome === 'yes').map(v => v.claim);

  const contradictedClaims = outcomes.filter(v => v.outcome === 'no').map(v => v.claim);

  const unsureClaims = outcomes.filter(v => v.outcome === 'unsure').map(v => v.claim);

  return `Explain the faithfulness score where 0 is the lowest and ${settings.scale} is the highest:
  
  Input: ${input}
  
  Output: ${output}
  
  Context:
  ${context?.join('\n\n') || 'No context provided'}
  
  Score: ${eval_result?.score}
  
  Supported Claims:
  ${supportedClaims.length > 0 ? supportedClaims.map((claim, i) => `${i + 1}. ${claim}`).join('\n') : 'None'}
  
  Contradicted Claims:
  ${contradictedClaims.length > 0 ? contradictedClaims.map((claim, i) => `${i + 1}. ${claim}`).join('\n') : 'None'}
  
  Unsure Claims:
  ${unsureClaims.length > 0 ? unsureClaims.map((claim, i) => `${i + 1}. ${claim}`).join('\n') : 'None'}
  
  Rules:
  - Explain score based on the proportion of supported claims
  - Keep explanation concise and focused
  - Use given score, don't recalculate
  - Explain both supported and unsupported aspects
  - For mixed responses, explain the balance
  
  Format:
  {
      "reason": "The score is {score} because {explanation of faithfulness}"
  }
  
  Example Responses:
  {
      "reason": "The score is 0.8 because 8 out of 10 claims in the output are directly supported by the context, with only 2 claims being unsupported or contradicted."
  }
  {
      "reason": "The score is 0.0 because none of the claims in the output are supported by the context, indicating a complete lack of faithfulness to the provided information."
  }
  `;
}

export async function generateEvaluationPrompt({ agent, output, context }: LLMEvaluatorPromptArgs) {
  const claimsPrompt = generateClaimExtractionPrompt({ output });
  const claimsResult = await agent.generate(claimsPrompt, {
    output: z.object({
      claims: z.array(z.string()),
    }),
  });

  const claims = claimsResult.object.claims;

  if (claims.length === 0) {
    return '';
  }

  const evaluatePrompt = generateEvaluatePrompt({ claims, context: context ?? [] });

  // This will be handled by the evaluator's evaluate method
  return evaluatePrompt;
}
