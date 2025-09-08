export const createExtractPrompt = ({ output, groundTruth }: { output: string; groundTruth: string }) => `
Extract and normalize the semantic units (facts, claims, concepts) from both the agent output and the ground truth answer.

Break down each text into its core semantic components while preserving meaning and relationships.
Focus on extracting:
- Key facts and claims
- Important concepts and entities
- Relationships between concepts
- Quantitative information
- Qualitative descriptions

Guidelines:
- Preserve the semantic meaning, not just keywords
- Group related information together
- Normalize different phrasings of the same concept
- Keep numerical values and units together
- Don't over-split compound concepts that belong together

Return ONLY valid JSON with two arrays of semantic units. Do not include any text before or after the JSON.

Agent Output:
${output}

Ground Truth:
${groundTruth}

Required JSON format (return valid JSON only):
{
  "outputUnits": [],
  "groundTruthUnits": []
}

Important: Return valid JSON only, no additional text or explanations.
`;

export const createAnalyzePrompt = ({
  outputUnits,
  groundTruthUnits,
}: {
  outputUnits: string[];
  groundTruthUnits: string[];
}) => `
Compare the semantic units from the agent output against the ground truth to evaluate answer similarity.

Analyze each ground truth unit and determine:
1. Whether it has a matching unit in the output (exact or semantic match)
2. The quality of the match (exact, semantic, partial, missing)
3. Whether there are contradictions

Also identify:
- Extra information in the output not present in ground truth
- Any contradictory statements between output and ground truth

Matching Guidelines:
- "exact": The same information expressed identically or with minor wording differences
- "semantic": The same concept or fact expressed differently but with equivalent meaning
- "partial": Some overlap but missing important details or context
- "missing": No corresponding information found in the output
- "contradiction": Information that directly conflicts with the ground truth (wrong facts, incorrect names, false claims)

CRITICAL: If the output contains factually incorrect information (wrong names, wrong facts, opposite claims), you MUST identify contradictions and mark relevant matches as "missing" while adding entries to the contradictions array.

Return ONLY valid JSON with detailed analysis. Do not include any text before or after the JSON.

Output Units:
${JSON.stringify(outputUnits, null, 2)}

Ground Truth Units:
${JSON.stringify(groundTruthUnits, null, 2)}

Required JSON format (copy this structure exactly):
{
  "matches": [
    {
      "groundTruthUnit": "unit from ground truth",
      "outputUnit": "corresponding unit from output or null if missing",
      "matchType": "exact",
      "explanation": "brief explanation of the match quality"
    }
  ],
  "extraInOutput": [],
  "contradictions": []
}

Important: 
- matchType must be exactly one of: "exact", "semantic", "partial", "missing"
- outputUnit must be a string or null (not undefined)
- All arrays must be present even if empty
- Return valid JSON only, no additional text
`;

export const createReasonPrompt = ({
  output,
  groundTruth,
  score,
  analysis,
  scale,
}: {
  output: string;
  groundTruth: string;
  score: number;
  analysis: {
    matches: Array<{
      groundTruthUnit: string;
      outputUnit: string | null;
      matchType: string;
      explanation: string;
    }>;
    extraInOutput: string[];
    contradictions: Array<{
      outputUnit: string;
      groundTruthUnit: string;
      explanation: string;
    }>;
  };
  scale: number;
}) => `
Generate a clear, actionable explanation of the answer similarity score.

Context:
- Agent Output: ${output}
- Ground Truth: ${groundTruth}
- Score: ${score}/${scale}
- Analysis: ${JSON.stringify(analysis, null, 2)}

Provide a concise explanation that:
1. States the overall similarity level (high/moderate/low)
2. Highlights what the agent got right
3. Identifies key missing or incorrect information
4. Suggests specific improvements if score is not perfect

Keep the explanation under 3 sentences and focus on actionable insights.

Format: "The score is {score}/{scale} because {explanation}. {what matched well}. {what needs improvement or is perfect}."

Example good responses:
- "The score is 0.9/1 because the answer captures all key concepts with minor phrasing differences. The agent correctly identified the main facts and relationships. Only missing a minor detail about the specific date mentioned in the ground truth."
- "The score is 0.5/1 because the answer is partially correct but missing crucial information. The agent correctly explained the basic concept. However, it missed the quantitative data and specific examples that were essential to the complete answer."
- "The score is 1.0/1 because the answer perfectly matches the ground truth semantically. All key facts, relationships, and details are accurately represented. No improvements needed."
`;
