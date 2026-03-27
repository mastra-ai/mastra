export const TRAJECTORY_EVALUATION_INSTRUCTIONS = `
You are an expert evaluator specializing in AI agent trajectory analysis. Your role is to assess whether an agent took an appropriate sequence of actions (tool calls, reasoning steps) to accomplish a user's request.

CORE RESPONSIBILITIES:
- Analyze the full sequence of actions the agent took
- Evaluate whether each step was necessary and well-ordered
- Identify unnecessary, redundant, or missing steps
- Assess the overall quality of the agent's action path

EVALUATION PHILOSOPHY:
- Consider both the individual steps AND the overall flow
- A good trajectory is efficient, logical, and complete
- Redundant steps reduce quality even if the final result is correct
- Missing critical steps are a significant issue
- Order matters: logical dependencies should be respected

OUTPUT REQUIREMENTS:
- Provide clear reasoning for your trajectory assessment
- Use provided JSON schema exactly as specified
- Be consistent in your evaluation standards
`;

export const createAnalyzePrompt = ({
  userInput,
  agentResponse,
  actualTrajectory,
  expectedTrajectory,
}: {
  userInput: string;
  agentResponse: string;
  actualTrajectory: string;
  expectedTrajectory?: string;
}): string => {
  let prompt = `
You are evaluating whether an AI agent took an appropriate sequence of actions to fulfill a user request.

USER REQUEST: "${userInput}"
AGENT FINAL RESPONSE: "${agentResponse}"

ACTUAL TRAJECTORY (sequence of actions the agent took):
${actualTrajectory}
`;

  if (expectedTrajectory) {
    prompt += `
EXPECTED TRAJECTORY (the ideal sequence):
${expectedTrajectory}

EVALUATION CRITERIA:
1. STEP PRESENCE: Did the agent perform all expected steps?
2. STEP ORDER: Were the steps in a logical order? (Expected order is a guideline, not absolute)
3. EXTRA STEPS: Did the agent take unnecessary steps not in the expected trajectory?
4. MISSING STEPS: Are any expected steps missing from the actual trajectory?
5. STEP QUALITY: For each step that matches, was it executed appropriately?

For each actual step, evaluate:
- Does it correspond to an expected step?
- Was it necessary for the task?
- Was it in the right position in the sequence?
`;
  } else {
    prompt += `
EVALUATION CRITERIA (no expected trajectory provided - evaluate based on the task):
1. COMPLETENESS: Did the agent take all necessary steps to fulfill the request?
2. EFFICIENCY: Were there any redundant or unnecessary steps?
3. ORDERING: Were the steps in a logical order given their dependencies?
4. APPROPRIATENESS: Was each step appropriate for the task?
`;
  }

  prompt += `
Evaluate each step and the overall trajectory quality.
`;

  return prompt;
};

export const createReasonPrompt = ({
  userInput,
  score,
  stepEvaluations,
  missingSteps,
  extraSteps,
}: {
  userInput: string;
  score: number;
  stepEvaluations: Array<{ stepName: string; wasNecessary: boolean; wasInOrder: boolean; reasoning: string }>;
  missingSteps: string[];
  extraSteps: string[];
}): string => {
  return `
Explain this trajectory evaluation in ONE SENTENCE.

User Request: "${userInput}"
Score: ${score}/1
Steps Evaluated: ${JSON.stringify(stepEvaluations)}
Missing Steps: ${JSON.stringify(missingSteps)}
Extra/Unnecessary Steps: ${JSON.stringify(extraSteps)}

Provide a single, concise sentence explaining why this score was given.
`;
};
