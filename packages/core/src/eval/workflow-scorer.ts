import { z } from 'zod';
import type { MastraLanguageModel } from '../memory';
import type { Step } from '../workflows/step';
import { createLLMScorer, type LLMScorerOptions, type ScoringRun } from './scorer';

// Types for workflow step evaluation
export type WorkflowStepRun = {
  runId: string;
  traceId?: string;
  workflowId: string;
  stepId: string;
  stepInput: any;
  stepOutput: any;
  stepError?: string;
  stepMetadata?: Record<string, any>;
  workflowContext?: Record<string, any>;
  executionTime?: number;
  retryCount?: number;
  source: 'WORKFLOW_STEP';
  entity: Record<string, any>;
  entityType: 'WORKFLOW_STEP';
  runtimeContext: Record<string, any>;
};

export type WorkflowStepScoringRun = ScoringRun & {
  workflowStep: WorkflowStepRun;
};

// Schema for extracted workflow step elements
export const workflowStepElementsSchema = z.object({
  stepExecution: z.object({
    inputData: z.any(),
    outputData: z.any(),
    errorMessage: z.string().optional(),
    executionTime: z.number().optional(),
    retryCount: z.number().optional(),
  }),
  stepBehavior: z.object({
    inputValidation: z.boolean(),
    outputValidation: z.boolean(),
    errorHandling: z.boolean(),
    performance: z.object({
      executionTime: z.number(),
      isWithinThreshold: z.boolean(),
    }),
  }),
  stepQuality: z.object({
    inputCompleteness: z.number(),
    outputCompleteness: z.number(),
    errorRate: z.number(),
    reliability: z.number(),
  }),
});

export type WorkflowStepElements = z.infer<typeof workflowStepElementsSchema>;

// Define the result schema for workflow step evaluation
const workflowStepResultSchema = z.array(
  z.object({
    result: z.string(),
    reason: z.string(),
  }),
);

// Default prompts for workflow step evaluation
export const defaultWorkflowStepPrompts = {
  extract: {
    prompt: `Analyze the following workflow step execution and extract key elements for evaluation:

Workflow Step Details:
- Step ID: {{stepId}}
- Workflow ID: {{workflowId}}
- Input: {{stepInput}}
- Output: {{stepOutput}}
- Error: {{stepError}}
- Execution Time: {{executionTime}}ms
- Retry Count: {{retryCount}}

Extract the following elements:
1. Step execution details (input, output, errors, timing)
2. Step behavior patterns (validation, error handling, performance)
3. Step quality metrics (completeness, reliability, error rates)

Focus on identifying:
- Input/output data quality
- Error patterns and handling
- Performance characteristics
- Reliability indicators`,
    description: 'Extract workflow step execution elements for evaluation',
  },
  score: {
    prompt: `Evaluate the following workflow step execution based on the extracted elements:

Step Execution Analysis:
{{statements}}

Evaluation Criteria:
1. **Input Quality** (0-1): How well does the step handle its input data?
2. **Output Quality** (0-1): How complete and accurate is the step's output?
3. **Error Handling** (0-1): How well does the step handle errors and edge cases?
4. **Performance** (0-1): How efficient is the step's execution?
5. **Reliability** (0-1): How consistently does the step perform?

Provide a detailed score for each criterion and an overall score.`,
    description: 'Score workflow step execution quality',
    transform: ({ results }: { results: z.infer<typeof workflowStepResultSchema> }) => {
      const scores = results.map((r: z.infer<typeof workflowStepResultSchema>[0]) => {
        const match = r.result.match(/(\d+(?:\.\d+)?)/);
        return match ? parseFloat(match[1]) : 0;
      });

      const overallScore = scores.length > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0;

      return {
        score: overallScore,
        results: results,
        detailedScores: {
          inputQuality: scores[0] || 0,
          outputQuality: scores[1] || 0,
          errorHandling: scores[2] || 0,
          performance: scores[3] || 0,
          reliability: scores[4] || 0,
        },
      };
    },
  },
  reason: {
    prompt: `Based on the workflow step evaluation results, provide detailed reasoning for the scores:

Step: {{stepId}}
Workflow: {{workflowId}}
Overall Score: {{score}}
Detailed Scores: {{detailedScores}}

Explain:
1. What factors contributed to each score
2. Specific strengths and weaknesses identified
3. Recommendations for improvement
4. Any patterns or trends in the step's behavior

Focus on actionable insights that can help improve the step's performance and reliability.`,
    description: 'Provide detailed reasoning for workflow step evaluation',
  },
};

// Create a workflow step scorer
export function createWorkflowStepScorer(opts: {
  name: string;
  description: string;
  model: MastraLanguageModel;
  prompts?: Partial<typeof defaultWorkflowStepPrompts>;
}): ReturnType<typeof createLLMScorer> {
  const prompts = {
    ...defaultWorkflowStepPrompts,
    ...opts.prompts,
  };

  const llmScorerOptions: LLMScorerOptions = {
    name: opts.name,
    description: opts.description,
    judge: {
      model: opts.model,
      instructions: 'You are an expert workflow evaluation system that analyzes step execution quality.',
    },
    prompts: {
      extract: {
        prompt: prompts.extract.prompt,
        description: prompts.extract.description,
      },
      score: {
        prompt: prompts.score.prompt,
        description: prompts.score.description,
        transform: prompts.score.transform,
      },
      reason: {
        prompt: prompts.reason.prompt,
        description: prompts.reason.description,
      },
    },
  };

  return createLLMScorer(llmScorerOptions);
}

// Specific workflow step evaluation scorers
export function createStepReliabilityScorer(model: MastraLanguageModel) {
  return createWorkflowStepScorer({
    name: 'Step Reliability Scorer',
    description: 'Evaluates workflow step reliability and consistency',
    model,
    prompts: {
      extract: {
        prompt: `Analyze the workflow step execution for reliability indicators:

Step: {{stepId}}
Input: {{stepInput}}
Output: {{stepOutput}}
Error: {{stepError}}
Execution Time: {{executionTime}}ms
Retry Count: {{retryCount}}

Extract reliability factors:
1. Error patterns and frequency
2. Retry behavior and success rates
3. Execution time consistency
4. Input/output validation success
5. Edge case handling`,
        description: 'Extract reliability indicators from workflow step execution',
      },
      score: {
        prompt: `Evaluate the step's reliability based on:

{{statements}}

Score the step on:
1. Error Rate (0-1): Lower is better
2. Retry Success Rate (0-1): Higher is better  
3. Execution Consistency (0-1): Lower variance is better
4. Validation Success (0-1): Higher is better
5. Edge Case Handling (0-1): Higher is better

Provide detailed reasoning for each score.`,
        description: 'Score workflow step reliability',
        transform: ({ results }: { results: z.infer<typeof workflowStepResultSchema> }) => {
          const scores = results.map((r: z.infer<typeof workflowStepResultSchema>[0]) => {
            const match = r.result.match(/(\d+(?:\.\d+)?)/);
            return match ? parseFloat(match[1]) : 0;
          });

          const overallScore =
            scores.length > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0;

          return {
            score: overallScore,
            results: results,
            detailedScores: {
              errorRate: scores[0] || 0,
              retrySuccessRate: scores[1] || 0,
              executionConsistency: scores[2] || 0,
              validationSuccess: scores[3] || 0,
              edgeCaseHandling: scores[4] || 0,
            },
          };
        },
      },
    },
  });
}

export function createStepPerformanceScorer(model: MastraLanguageModel) {
  return createWorkflowStepScorer({
    name: 'Step Performance Scorer',
    description: 'Evaluates workflow step performance and efficiency',
    model,
    prompts: {
      extract: {
        prompt: `Analyze the workflow step execution for performance indicators:

Step: {{stepId}}
Input Size: {{inputSize}}
Output Size: {{outputSize}}
Execution Time: {{executionTime}}ms
Memory Usage: {{memoryUsage}}
CPU Usage: {{cpuUsage}}

Extract performance factors:
1. Execution time patterns
2. Resource utilization
3. Input/output efficiency
4. Scalability indicators
5. Bottleneck identification`,
        description: 'Extract performance indicators from workflow step execution',
      },
      score: {
        prompt: `Evaluate the step's performance based on:

{{statements}}

Score the step on:
1. Execution Speed (0-1): Faster is better
2. Resource Efficiency (0-1): Lower resource usage is better
3. Scalability (0-1): How well it handles larger inputs
4. Consistency (0-1): Predictable performance
5. Optimization Potential (0-1): Room for improvement

Provide detailed reasoning for each score.`,
        description: 'Score workflow step performance',
        transform: ({ results }: { results: z.infer<typeof workflowStepResultSchema> }) => {
          const scores = results.map((r: z.infer<typeof workflowStepResultSchema>[0]) => {
            const match = r.result.match(/(\d+(?:\.\d+)?)/);
            return match ? parseFloat(match[1]) : 0;
          });

          const overallScore =
            scores.length > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0;

          return {
            score: overallScore,
            results: results,
            detailedScores: {
              executionSpeed: scores[0] || 0,
              resourceEfficiency: scores[1] || 0,
              scalability: scores[2] || 0,
              consistency: scores[3] || 0,
              optimizationPotential: scores[4] || 0,
            },
          };
        },
      },
    },
  });
}

export function createStepQualityScorer(model: MastraLanguageModel) {
  return createWorkflowStepScorer({
    name: 'Step Quality Scorer',
    description: 'Evaluates workflow step output quality and accuracy',
    model,
    prompts: {
      extract: {
        prompt: `Analyze the workflow step execution for quality indicators:

Step: {{stepId}}
Expected Output Schema: {{expectedSchema}}
Actual Output: {{stepOutput}}
Input Quality: {{inputQuality}}
Validation Results: {{validationResults}}

Extract quality factors:
1. Output completeness vs expected schema
2. Data accuracy and consistency
3. Format compliance
4. Business logic adherence
5. Error handling quality`,
        description: 'Extract quality indicators from workflow step execution',
      },
      score: {
        prompt: `Evaluate the step's output quality based on:

{{statements}}

Score the step on:
1. Completeness (0-1): All required fields present
2. Accuracy (0-1): Correct data and logic
3. Consistency (0-1): Reliable output format
4. Validation (0-1): Proper error checking
5. Business Logic (0-1): Correct application logic

Provide detailed reasoning for each score.`,
        description: 'Score workflow step quality',
        transform: ({ results }: { results: z.infer<typeof workflowStepResultSchema> }) => {
          const scores = results.map((r: z.infer<typeof workflowStepResultSchema>[0]) => {
            const match = r.result.match(/(\d+(?:\.\d+)?)/);
            return match ? parseFloat(match[1]) : 0;
          });

          const overallScore =
            scores.length > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0;

          return {
            score: overallScore,
            results: results,
            detailedScores: {
              completeness: scores[0] || 0,
              accuracy: scores[1] || 0,
              consistency: scores[2] || 0,
              validation: scores[3] || 0,
              businessLogic: scores[4] || 0,
            },
          };
        },
      },
    },
  });
}

// Utility function to convert workflow step data to scoring run
export function createWorkflowStepScoringRun(
  workflowStep: WorkflowStepRun,
  additionalContext?: Record<string, any>,
): WorkflowStepScoringRun {
  return {
    runId: workflowStep.runId,
    traceId: workflowStep.traceId,
    scorer: {
      name: 'workflow-step-scorer',
      type: 'workflow-step',
    },
    input: [], // Not applicable for workflow steps
    output: {
      stepId: workflowStep.stepId,
      workflowId: workflowStep.workflowId,
      stepInput: workflowStep.stepInput,
      stepOutput: workflowStep.stepOutput,
      stepError: workflowStep.stepError,
      executionTime: workflowStep.executionTime,
      retryCount: workflowStep.retryCount,
    },
    metadata: {
      ...workflowStep.stepMetadata,
      ...additionalContext,
    },
    source: 'LIVE' as const, // Use the existing source type
    entity: workflowStep.entity,
    entityType: 'AGENT' as const, // Use the existing entity type
    runtimeContext: workflowStep.runtimeContext,
    workflowStep,
  };
}

// Helper function to evaluate a workflow step
export async function evaluateWorkflowStep(
  step: Step,
  stepInput: any,
  stepOutput: any,
  scorer: ReturnType<typeof createLLMScorer>,
  stepError?: string,
  executionTime?: number,
  retryCount?: number,
) {
  const workflowStep: WorkflowStepRun = {
    runId: `step-${Date.now()}`,
    workflowId: 'unknown',
    stepId: step.id,
    stepInput,
    stepOutput,
    stepError,
    executionTime,
    retryCount,
    source: 'WORKFLOW_STEP',
    entity: { stepId: step.id },
    entityType: 'WORKFLOW_STEP',
    runtimeContext: {},
  };

  const scoringRun = createWorkflowStepScoringRun(workflowStep);
  return await scorer.evaluate(scoringRun);
}
