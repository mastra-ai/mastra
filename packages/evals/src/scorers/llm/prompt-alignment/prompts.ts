export const PROMPT_ALIGNMENT_INSTRUCTIONS = `You are an expert prompt-response alignment evaluator. Your job is to analyze how well an agent's response aligns with the user's prompt in terms of intent, requirements, completeness, and appropriateness.

Key Evaluation Dimensions:
1. **Intent Alignment**: Does the response address the core purpose of the prompt?
2. **Requirements Fulfillment**: Are all explicit and implicit requirements met?
3. **Completeness**: Is the response comprehensive and thorough?
4. **Response Appropriateness**: Does the format, tone, and style match expectations?

Evaluation Guidelines:
- Identify the primary intent and any secondary intents in the prompt
- Extract all explicit requirements (specific tasks, constraints, formats)
- Consider implicit requirements based on context and standard expectations
- Assess whether the response fully addresses the prompt or leaves gaps
- Evaluate if the response format and tone are appropriate for the request
- Be objective and focus on alignment rather than response quality

Score each dimension from 0.0 (completely misaligned) to 1.0 (perfectly aligned).`;

export function createAnalyzePrompt({ userPrompt, agentResponse }: { userPrompt: string; agentResponse: string }) {
  return `Analyze how well the agent's response aligns with the user's prompt across multiple dimensions.

User Prompt:
${userPrompt}

Agent Response:
${agentResponse}

Evaluate the following aspects:

1. **Intent Alignment**:
   - Identify the primary intent of the user's prompt
   - Assess whether the response addresses this intent
   - Score from 0.0 (completely misses intent) to 1.0 (perfectly addresses intent)
   - Provide reasoning for your assessment

2. **Requirements Fulfillment**:
   - List all explicit requirements from the prompt
   - Check if each requirement is fulfilled
   - Calculate an overall score based on fulfilled vs. total requirements
   - Provide reasoning for each requirement assessment

3. **Completeness**:
   - Evaluate if the response is comprehensive
   - Identify any missing elements that should have been included
   - Score from 0.0 (severely incomplete) to 1.0 (fully complete)
   - Provide reasoning for your assessment

4. **Response Appropriateness**:
   - Check if the format matches what was requested (e.g., list, paragraph, code)
   - Evaluate if the tone is appropriate (e.g., formal, casual, technical)
   - Score from 0.0 (completely inappropriate) to 1.0 (perfectly appropriate)
   - Provide reasoning for your assessment

Format your response as:
{
  "intentAlignment": {
    "score": 0.0-1.0,
    "primaryIntent": "the main purpose of the prompt",
    "isAddressed": true/false,
    "reasoning": "explanation of intent alignment"
  },
  "requirementsFulfillment": {
    "requirements": [
      {
        "requirement": "specific requirement from prompt",
        "isFulfilled": true/false,
        "reasoning": "explanation of fulfillment status"
      }
    ],
    "overallScore": 0.0-1.0
  },
  "completeness": {
    "score": 0.0-1.0,
    "missingElements": ["list of missing elements if any"],
    "reasoning": "explanation of completeness assessment"
  },
  "responseAppropriateness": {
    "score": 0.0-1.0,
    "formatAlignment": true/false,
    "toneAlignment": true/false,
    "reasoning": "explanation of appropriateness"
  },
  "overallAssessment": "summary of the prompt-response alignment"
}

Example:
User Prompt: "Write a Python function to calculate factorial with error handling for negative numbers."

Agent Response: "def factorial(n):
    if n < 0:
        raise ValueError('Factorial not defined for negative numbers')
    if n == 0:
        return 1
    return n * factorial(n-1)"

{
  "intentAlignment": {
    "score": 1.0,
    "primaryIntent": "Create a Python function to calculate factorial",
    "isAddressed": true,
    "reasoning": "The response provides exactly what was requested - a Python function that calculates factorial"
  },
  "requirementsFulfillment": {
    "requirements": [
      {
        "requirement": "Write a Python function",
        "isFulfilled": true,
        "reasoning": "A proper Python function is provided with correct syntax"
      },
      {
        "requirement": "Calculate factorial",
        "isFulfilled": true,
        "reasoning": "The function correctly implements factorial calculation using recursion"
      },
      {
        "requirement": "Include error handling for negative numbers",
        "isFulfilled": true,
        "reasoning": "The function raises a ValueError for negative inputs with an appropriate message"
      }
    ],
    "overallScore": 1.0
  },
  "completeness": {
    "score": 0.9,
    "missingElements": ["No docstring or comments"],
    "reasoning": "The function is complete and functional but could benefit from documentation"
  },
  "responseAppropriateness": {
    "score": 1.0,
    "formatAlignment": true,
    "toneAlignment": true,
    "reasoning": "The response is in the exact format requested (Python code) with appropriate technical implementation"
  },
  "overallAssessment": "The response perfectly aligns with the prompt, providing a correct Python factorial function with the requested error handling for negative numbers"
}`;
}

export type AnalysisResult = {
  intentAlignment: {
    score: number;
    primaryIntent: string;
    isAddressed: boolean;
    reasoning: string;
  };
  requirementsFulfillment: {
    requirements: Array<{
      requirement: string;
      isFulfilled: boolean;
      reasoning: string;
    }>;
    overallScore: number;
  };
  completeness: {
    score: number;
    missingElements: string[];
    reasoning: string;
  };
  responseAppropriateness: {
    score: number;
    formatAlignment: boolean;
    toneAlignment: boolean;
    reasoning: string;
  };
  overallAssessment: string;
};

export function createReasonPrompt({
  userPrompt,
  score,
  scale,
  analysis,
}: {
  userPrompt: string;
  score: number;
  scale: number;
  analysis: AnalysisResult;
}) {
  const fulfilledCount = analysis.requirementsFulfillment.requirements.filter(r => r.isFulfilled).length;
  const totalRequirements = analysis.requirementsFulfillment.requirements.length;

  return `Explain the prompt alignment score based on how well the agent's response addresses the user's prompt.

User Prompt:
${userPrompt}

Score: ${score} out of ${scale}

Evaluation Breakdown:
- Intent Alignment (40% weight): ${analysis.intentAlignment.score}
  Primary Intent: "${analysis.intentAlignment.primaryIntent}"
  Addressed: ${analysis.intentAlignment.isAddressed ? 'Yes' : 'No'}
  ${analysis.intentAlignment.reasoning}

- Requirements Fulfillment (30% weight): ${analysis.requirementsFulfillment.overallScore}
  ${fulfilledCount} out of ${totalRequirements} requirements met
  ${analysis.requirementsFulfillment.requirements
    .map(r => `• ${r.requirement}: ${r.isFulfilled ? '✓' : '✗'}`)
    .join('\n  ')}

- Completeness (20% weight): ${analysis.completeness.score}
  ${
    analysis.completeness.missingElements.length > 0
      ? `Missing elements: ${analysis.completeness.missingElements.join(', ')}`
      : 'Response is complete'
  }
  ${analysis.completeness.reasoning}

- Response Appropriateness (10% weight): ${analysis.responseAppropriateness.score}
  Format: ${analysis.responseAppropriateness.formatAlignment ? 'Aligned' : 'Misaligned'}
  Tone: ${analysis.responseAppropriateness.toneAlignment ? 'Aligned' : 'Misaligned'}
  ${analysis.responseAppropriateness.reasoning}

Overall Assessment: ${analysis.overallAssessment}

Prompt Alignment measures how well the response addresses the user's request across intent, requirements, completeness, and appropriateness. The weighted scoring ensures primary focus on understanding and addressing the core intent while meeting specific requirements.

Rules for explanation:
- Summarize the key strengths and weaknesses of alignment
- Highlight any major misalignments that significantly impacted the score
- Be concise but comprehensive in the explanation
- Use the given score, don't recalculate

Format:
"The score is ${score} because {explanation of alignment strengths and weaknesses based on the weighted dimensions}"

Example responses:
"The score is 0.95 because the response perfectly addresses the primary intent and fulfills all requirements, with only minor gaps in documentation completeness."
"The score is 0.70 because while the response addresses the main intent, it misses 2 out of 5 specific requirements and uses an inappropriate format for the request."
"The score is 0.40 because the response partially addresses the intent but misses key requirements and lacks completeness in critical areas."`;
}
