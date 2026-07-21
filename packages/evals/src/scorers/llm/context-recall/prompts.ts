export const CONTEXT_RECALL_AGENT_INSTRUCTIONS = `You are a precise context recall evaluator. Your job is to determine if the retrieved context contains enough information to support all the claims in a ground-truth reference answer.

Key Principles:
1. First extract all atomic claims/sentences from the ground-truth answer
2. Then verify each claim against the provided retrieval context
3. A claim is attributable if any part of the retrieval context directly supports it
4. A claim is not attributable if no part of the retrieval context mentions or implies it
5. Focus on information coverage, not exact wording
6. Be strict in attribution - the context must actually contain supporting information
7. Never use prior knowledge in judgments - only use the provided context`;

export function createClaimExtractionPrompt({ groundTruth }: { groundTruth: string }) {
  return `Extract all atomic claims from the given ground-truth answer. A claim is any single statement that asserts one piece of information.

Guidelines for claim extraction:
- Break down compound statements into individual claims
- Each claim should be self-contained and verifiable independently
- Include all factual assertions, including numbers, dates, and quantities
- Keep relationships between entities intact within each claim
- Exclude questions, commands, and purely stylistic text
- Preserve the original meaning without adding interpretation

Example:
Text: "Albert Einstein was born on 14 March 1879 in Ulm, Germany. He developed the theory of relativity and won the Nobel Prize in Physics in 1921."

{
    "claims": [
        "Albert Einstein was born on 14 March 1879",
        "Albert Einstein was born in Ulm, Germany",
        "Albert Einstein developed the theory of relativity",
        "Albert Einstein won the Nobel Prize in Physics",
        "Albert Einstein won the Nobel Prize in 1921"
    ]
}

Please return only JSON format with "claims" array.
Return empty list for empty input.

Ground-Truth Answer:
${groundTruth}

JSON:
`;
}

export function createClaimAttributionPrompt({ claims, context }: { claims: string[]; context: string[] }) {
  return `Determine if each claim from the ground-truth answer can be attributed to the provided retrieval context. A claim is attributable if any part of the context directly supports or contains the information in that claim.

Retrieval Context:
${context.map((ctx, index) => `[${index}] ${ctx}`).join('\n')}

Number of claims: ${claims.length}

Claims to verify:
${claims.map((claim, index) => `[${index}] ${claim}`).join('\n')}

For each claim, provide a verdict and reasoning. The verdict must be one of:
- "yes" if the claim can be attributed to information in the retrieval context
- "no" if the claim cannot be attributed to any part of the retrieval context

The number of verdicts MUST MATCH the number of claims exactly.

Format:
{
    "verdicts": [
        {
            "verdict": "yes/no",
            "reason": "explanation of why this claim is or isn't attributable to the context"
        }
    ]
}

Rules:
- Only use information from the provided retrieval context
- Mark claims as "yes" if the context contains supporting information, even if the wording differs
- Mark claims as "no" if the context does not mention or imply the information
- Never use prior knowledge in your judgment
- Provide clear reasoning that references specific context pieces

Example:
Context:
[0] "Albert Einstein was born on 14 March 1879 in Ulm, Germany."
[1] "Einstein published his theory of special relativity in 1905."

Claims:
[0] "Albert Einstein was born on 14 March 1879"
[1] "Albert Einstein won the Nobel Prize in 1921"

{
    "verdicts": [
        {
            "verdict": "yes",
            "reason": "Context node [0] explicitly states Einstein was born on 14 March 1879"
        },
        {
            "verdict": "no",
            "reason": "No part of the retrieval context mentions Einstein winning the Nobel Prize"
        }
    ]
}`;
}

export function createContextRecallReasonPrompt({
  groundTruth,
  context,
  score,
  scale,
  verdicts,
}: {
  groundTruth: string;
  context: string[];
  score: number;
  scale: number;
  verdicts: { verdict: string; reason: string }[];
}) {
  return `Explain the context recall score for the retrieval context based on how well it covers the claims in the ground-truth answer.

Ground-Truth Answer:
${groundTruth}

Retrieval Context:
${context.map((ctx, index) => `[${index}] ${ctx}`).join('\n')}

Score: ${score} out of ${scale}
Verdicts:
${JSON.stringify(verdicts, null, 2)}

Context Recall measures what fraction of the ground-truth answer's claims are supported by the retrieved context. The score is calculated as:
- Extract all claims from the ground-truth answer
- Check each claim against the retrieval context
- Score = (attributed claims / total claims) × scale

Rules for explanation:
- Explain which claims were and were not found in the context
- Mention specific context pieces that supported attributed claims
- Highlight what information was missing for unattributed claims
- Keep explanation concise and focused on coverage gaps
- Use the given score, don't recalculate

Format:
"The score is ${score} because {explanation of context recall}"

Example responses:
"The score is 0.67 because 2 out of 3 ground-truth claims are supported by the retrieval context. The claims about Einstein's birthdate and birthplace are covered by context node [0], but the claim about the Nobel Prize is not mentioned in any context node."
"The score is 1.0 because all claims in the ground-truth answer are fully supported by the retrieval context."
"The score is 0.0 because none of the ground-truth claims could be attributed to the retrieval context."`;
}
