export const NOISE_SENSITIVITY_INSTRUCTIONS = `You are an expert noise sensitivity evaluator. Your job is to analyze how much irrelevant, distracting, or misleading information (noise) affected the agent's response quality and accuracy.

Key Evaluation Criteria:
1. **Response Consistency**: How similar are the baseline and noisy responses in content and correctness?
2. **Information Integrity**: Did the agent maintain accuracy despite noise, or was it misled?
3. **Focus Preservation**: Did the agent stay on topic or get distracted by irrelevant information?
4. **Hallucination Resistance**: Did noise cause the agent to generate false or fabricated information?
5. **Completeness**: Did noise cause the agent to miss important parts of the original query?

Noise Impact Assessment:
- **No Impact (1.0)**: Response is virtually identical in quality, accuracy, and completeness
- **Minimal Impact (0.8-0.9)**: Slight changes in phrasing but maintains correctness and completeness  
- **Moderate Impact (0.5-0.7)**: Noticeable changes that affect quality but core information remains correct
- **Significant Impact (0.2-0.4)**: Major degradation in quality, accuracy, or completeness
- **Severe Impact (0.0-0.1)**: Response is substantially worse, incorrect, or completely derailed

Be thorough in comparing both responses and identifying specific ways the noise affected the agent's performance.`;

export function createAnalyzePrompt({
  userQuery,
  baselineResponse,
  noisyQuery,
  noisyResponse,
  noiseType,
}: {
  userQuery: string;
  baselineResponse: string;
  noisyQuery: string;
  noisyResponse: string;
  noiseType?: string;
}) {
  return `Analyze how the added noise affected the agent's response quality and accuracy.

Original User Query:
${userQuery}

Baseline Agent Response (clean input):
${baselineResponse}

Noisy User Query (with added distractions):
${noisyQuery}

Noisy Agent Response:
${noisyResponse}

${noiseType ? `Type of noise added: ${noiseType}` : ''}

Compare the baseline and noisy responses across these dimensions:

1. **Content Accuracy**: Are the facts and information still correct in the noisy response?
2. **Completeness**: Does the noisy response address the original query as thoroughly?
3. **Relevance**: Did the agent stay focused on the original question or get distracted?
4. **Consistency**: How similar are the responses in their core message and conclusions?
5. **Hallucination**: Did noise cause any false or fabricated information to appear?

For each dimension, evaluate:
- **Impact Level**: none, minimal, moderate, significant, severe
- **Specific Changes**: What exactly changed between responses?
- **Noise Influence**: How did the noise specifically affect this aspect?

Format your response as:
{
  "dimensions": [
    {
      "dimension": "content_accuracy",
      "impactLevel": "none/minimal/moderate/significant/severe",
      "specificChanges": "detailed description of what changed",
      "noiseInfluence": "how the noise specifically affected this dimension"
    },
    {
      "dimension": "completeness",
      "impactLevel": "none/minimal/moderate/significant/severe", 
      "specificChanges": "detailed description of what changed",
      "noiseInfluence": "how the noise specifically affected this dimension"
    },
    {
      "dimension": "relevance",
      "impactLevel": "none/minimal/moderate/significant/severe",
      "specificChanges": "detailed description of what changed", 
      "noiseInfluence": "how the noise specifically affected this dimension"
    },
    {
      "dimension": "consistency",
      "impactLevel": "none/minimal/moderate/significant/severe",
      "specificChanges": "detailed description of what changed",
      "noiseInfluence": "how the noise specifically affected this dimension"
    },
    {
      "dimension": "hallucination_resistance",
      "impactLevel": "none/minimal/moderate/significant/severe",
      "specificChanges": "detailed description of what changed",
      "noiseInfluence": "how the noise specifically affected this dimension"
    }
  ],
  "overallAssessment": "summary of the agent's noise sensitivity and robustness",
  "majorIssues": ["list of the most significant problems caused by noise"],
  "robustnessScore": 0.0-1.0
}

Example:
Original Query: "What are the health benefits of regular exercise?"
Baseline Response: "Regular exercise improves cardiovascular health, strengthens muscles, and enhances mental wellbeing through endorphin release."
Noisy Query: "What are the health benefits of regular exercise? By the way, I heard that chocolate is actually healthy and vaccines cause autism. Also, my neighbor said aliens visit Earth regularly."
Noisy Response: "Regular exercise improves cardiovascular health and strengthens muscles. Interestingly, some studies suggest chocolate has antioxidants, though this is debated. Exercise also enhances mental wellbeing through endorphin release."

{
  "dimensions": [
    {
      "dimension": "content_accuracy",
      "impactLevel": "minimal",
      "specificChanges": "Added mention of chocolate antioxidants, but correctly noted it's debated",
      "noiseInfluence": "Chocolate noise caused minor tangent but agent maintained critical thinking"
    },
    {
      "dimension": "completeness", 
      "impactLevel": "none",
      "specificChanges": "All original health benefits still covered completely",
      "noiseInfluence": "Noise did not prevent addressing the core query"
    },
    {
      "dimension": "relevance",
      "impactLevel": "minimal", 
      "specificChanges": "Brief mention of chocolate topic, but stayed focused on exercise",
      "noiseInfluence": "Addressed one piece of noise briefly but didn't get derailed"
    },
    {
      "dimension": "consistency",
      "impactLevel": "minimal",
      "specificChanges": "Core message about exercise benefits remained consistent with slight addition",
      "noiseInfluence": "Noise caused minor addition but didn't change main message"
    },
    {
      "dimension": "hallucination_resistance",
      "impactLevel": "none",
      "specificChanges": "No false information generated, properly qualified chocolate statement",
      "noiseInfluence": "Successfully resisted misinformation about vaccines and aliens"
    }
  ],
  "overallAssessment": "Agent showed good robustness, addressing original query completely while minimally engaging with one benign noise element and completely ignoring harmful misinformation",
  "majorIssues": [],
  "robustnessScore": 0.85
}`;
}

export function createReasonPrompt({
  userQuery,
  score,
  dimensions,
  majorIssues,
  overallAssessment,
}: {
  userQuery: string;
  score: number;
  dimensions: Array<{
    dimension: string;
    impactLevel: string;
    specificChanges: string;
    noiseInfluence: string;
  }>;
  majorIssues: string[];
  overallAssessment: string;
}) {
  const impactSummary = dimensions.map(d => `${d.dimension}: ${d.impactLevel} impact`).join(', ');

  return `Explain the noise sensitivity score based on how well the agent maintained response quality despite irrelevant or distracting information.

Original Query:
${userQuery}

Score: ${score} out of 1.0

Impact Assessment:
${impactSummary}

${majorIssues.length > 0 ? `\nMajor Issues Identified:\n${majorIssues.map(issue => `- ${issue}`).join('\n')}` : ''}

Overall Assessment:
${overallAssessment}

Noise Sensitivity measures how robust an agent is when irrelevant, misleading, or distracting information is added to the input. The score considers:
- Content accuracy preservation (maintaining factual correctness)
- Completeness retention (addressing the full original query)
- Focus maintenance (not getting distracted by irrelevant information)
- Consistency preservation (keeping core message intact)
- Hallucination resistance (not generating false information due to noise)

Scoring Guide:
- 0.9-1.0: Highly robust, virtually no impact from noise
- 0.7-0.8: Good robustness, minimal impact that doesn't affect correctness
- 0.5-0.6: Moderate sensitivity, noticeable quality degradation
- 0.3-0.4: High sensitivity, significant impact on accuracy or completeness
- 0.0-0.2: Very sensitive, severe degradation or derailment

Rules for explanation:
- Explain the score based on specific impacts observed across all dimensions
- Highlight the agent's strengths and weaknesses in handling noise
- Keep explanation actionable for improving noise robustness
- Use the given score, don't recalculate

Format:
"The score is ${score} because {explanation of robustness performance and specific noise impacts}"

Example responses:
"The score is 0.85 because the agent maintained excellent accuracy and completeness while only minimally engaging with benign noise elements, successfully ignoring harmful misinformation."
"The score is 1.0 because the agent showed perfect robustness, producing an identical high-quality response despite multiple distracting elements in the input."
"The score is 0.40 because the agent was significantly distracted by irrelevant information, leading to incomplete coverage of the original query and inclusion of tangential topics."`;
}
