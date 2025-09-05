export const MULTIMODAL_FAITHFULNESS_AGENT_INSTRUCTIONS = `
You are a multimodal faithfulness evaluator specialized in verifying claims against both textual and visual contexts. Your job is to determine if LLM outputs are factually consistent with the provided multimodal contexts.

Key Principles:
1. Extract all claims from the output (both factual and speculative)
2. Verify each claim against BOTH textual and visual contexts
3. A claim is supported if it can be verified from either text or visual information
4. A claim is contradicted if it conflicts with information in text or visual contexts  
5. A claim is unsure if it cannot be verified from any provided context
6. Empty outputs have no claims to evaluate
7. Focus on factual consistency, not relevance or completeness
8. Never use external knowledge - only evaluate based on provided contexts
9. For visual contexts, consider what can reasonably be observed or interpreted
10. Claims with speculative language (may, might, possibly) should be marked as "unsure" unless supported

Visual Context Evaluation:
- Consider objects, people, scenes, text visible in images
- Evaluate spatial relationships and compositions
- Assess colors, lighting, and visual attributes
- Include readable text or symbols in images
- Consider contextual information that can be inferred from visual elements
`;

export const createMultimodalFaithfulnessExtractPrompt = ({ output }: { output: string }) => {
  return `Extract all claims from the given output. A claim is any statement that asserts information, including both factual and speculative assertions.

Guidelines for claim extraction:
- Break down compound statements into individual claims
- Include all statements that assert information about the content
- Include both definitive and speculative claims (using words like may, might, could)
- Extract specific details like numbers, dates, quantities, and visual descriptions
- Keep relationships between entities and visual elements
- Include predictions and possibilities
- Extract claims with their full context
- Include claims about visual elements (colors, objects, spatial relationships, etc.)
- Exclude only questions and commands

Example:
Text: "The image shows a red Tesla Model S parked next to a blue building. The car appears to be from 2020 and looks well-maintained. There might be people visible in the background."

{
    "claims": [
        "The image shows a red Tesla Model S",
        "The Tesla Model S is parked next to a blue building", 
        "The car appears to be from 2020",
        "The car looks well-maintained",
        "There might be people visible in the background"
    ]
}

Note: All assertions are included, including visual descriptions and speculative statements, as they need to be verified against the multimodal contexts.

Please return only JSON format with "claims" array.
Return empty list for empty input.

Text:
${output}

JSON:
`;
};

export const createMultimodalFaithfulnessAnalyzePrompt = ({
  claims,
  contexts,
}: {
  claims: string[];
  contexts: Array<{ type: 'text' | 'image' | 'multimodal'; content: string | any }>;
}) => {
  const contextDescription = contexts
    .map((ctx, index) => {
      if (ctx.type === 'text') {
        return `Context ${index + 1} (Text): ${ctx.content}`;
      } else if (ctx.type === 'image') {
        return `Context ${index + 1} (Image): [Visual content available for analysis]`;
      } else {
        return `Context ${index + 1} (Multimodal): ${typeof ctx.content === 'string' ? ctx.content : '[Complex multimodal content]'}`;
      }
    })
    .join('\n\n');

  return `Evaluate each claim for faithfulness against the provided multimodal contexts. 

EVALUATION CRITERIA:

A claim is SUPPORTED ("yes") when:
- It can be directly verified from textual context information
- It accurately describes what is visible in image contexts  
- It correctly states relationships or attributes shown in visual content
- It matches information that can be reasonably inferred from multimodal contexts

A claim is CONTRADICTED ("no") when:
- It directly conflicts with information in textual contexts
- It misrepresents what is shown in image contexts
- It states incorrect visual attributes (wrong colors, objects, relationships)
- It contradicts information that can be clearly observed in visual content

A claim is UNVERIFIABLE ("unsure") when:
- It cannot be confirmed from any provided context (text or visual)
- It requires external knowledge not present in the contexts
- It makes speculative statements not supported by available information
- It refers to elements not visible or mentioned in the contexts

MULTIMODAL EVALUATION GUIDELINES:
- For text contexts: Check for explicit statements and factual information
- For image contexts: Evaluate what can be visually observed and reasonably interpreted
- Consider both explicit visual elements and reasonable inferences from visual content
- Claims about visual attributes must match what can be observed in images
- Spatial relationships and compositions should be accurately described

PROVIDED CONTEXTS:
${contextDescription}

CLAIMS TO EVALUATE:
${claims.map((claim, index) => `${index + 1}. ${claim}`).join('\n')}

For each claim, provide your verdict and detailed reasoning. Return JSON format:

{
  "verdicts": [
    {
      "claim": "The specific claim being evaluated",
      "verdict": "yes|no|unsure", 
      "reason": "Detailed explanation of why this claim is supported, contradicted, or unverifiable based on the multimodal contexts"
    }
  ]
}

JSON:
`;
};

export const createMultimodalFaithfulnessReasonPrompt = ({
  claims,
  verdicts,
  score,
  scale,
}: {
  claims: string[];
  verdicts: Array<{ claim: string; verdict: string; reason: string }>;
  score: number;
  scale: number;
}) => {
  const supportedCount = verdicts.filter(v => v.verdict === 'yes').length;
  const contradictedCount = verdicts.filter(v => v.verdict === 'no').length;
  const unsureCount = verdicts.filter(v => v.verdict === 'unsure').length;

  return `Explain the multimodal faithfulness score where 0 is completely unfaithful and ${scale} is perfectly faithful.

EVALUATION SUMMARY:
- Total Claims: ${claims.length}
- Supported by Contexts: ${supportedCount}
- Contradicted by Contexts: ${contradictedCount}  
- Unverifiable: ${unsureCount}
- Final Score: ${score}/${scale}

VERDICTS:
${verdicts.map((v, i) => `${i + 1}. "${v.claim}" - ${v.verdict.toUpperCase()}: ${v.reason}`).join('\n')}

Provide a concise explanation that:
1. Summarizes the overall faithfulness to multimodal contexts
2. Highlights key supported or contradicted claims
3. Notes the balance between text and visual context verification
4. Explains how multimodal elements influenced the assessment

Format: "The score is ${score} because [explanation of multimodal faithfulness assessment]"

Keep the explanation focused and reference specific examples from the evaluation when helpful.`;
};
