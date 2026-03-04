import { createScorer } from '@mastra/core/evals';
import { Agent } from '@mastra/core/agent';
import type { QuestionType } from '../data/types';

export interface LongMemEvalInput {
  question: string;
  answer: string;
  questionType: QuestionType;
  isAbstention?: boolean;
}

export interface LongMemEvalOutput {
  response: string;
}

/**
 * Get the evaluation prompt based on question type
 *
 * These prompts are copied EXACTLY from the official LongMemEval benchmark:
 * https://github.com/xiaowu0162/LongMemEval/blob/main/src/evaluation/evaluate_qa.py
 *
 * IMPORTANT: Do not modify these prompts - they must match the official benchmark
 * for comparable results with other systems (SuperMemory, EMem, etc.)
 */
function getEvalPrompt(
  taskType: QuestionType,
  question: string,
  answer: string,
  response: string,
  isAbstention: boolean,
): string {
  // Official LongMemEval abstention prompt
  if (isAbstention) {
    return `I will give you an unanswerable question, an explanation, and a response from a model. Please answer yes if the model correctly identifies the question as unanswerable. The model could say that the information is incomplete, or some other information is given but the asked information is not.

Question: ${question}

Explanation: ${answer}

Model Response: ${response}

Does the model correctly identify the question as unanswerable? Answer yes or no only.`;
  }

  switch (taskType) {
    // Official LongMemEval default prompt (single-session-user, single-session-assistant, multi-session)
    case 'single-session-user':
    case 'single-session-assistant':
    case 'multi-session':
      return `I will give you a question, a correct answer, and a response from a model. Please answer yes if the response contains the correct answer. Otherwise, answer no. If the response is equivalent to the correct answer or contains all the intermediate steps to get the correct answer, you should also answer yes. If the response only contains a subset of the information required by the answer, answer no.

Question: ${question}

Correct Answer: ${answer}

Model Response: ${response}

Is the model response correct? Answer yes or no only.`;

    // Official LongMemEval temporal-reasoning prompt
    // NOTE: Includes off-by-one leniency for day/week/month counts
    case 'temporal-reasoning':
      return `I will give you a question, a correct answer, and a response from a model. Please answer yes if the response contains the correct answer. Otherwise, answer no. If the response is equivalent to the correct answer or contains all the intermediate steps to get the correct answer, you should also answer yes. If the response only contains a subset of the information required by the answer, answer no. In addition, do not penalize off-by-one errors for the number of days. If the question asks for the number of days/weeks/months, etc., and the model makes off-by-one errors (e.g., predicting 19 days when the answer is 18), the model's response is still correct.

Question: ${question}

Correct Answer: ${answer}

Model Response: ${response}

Is the model response correct? Answer yes or no only.`;

    // Official LongMemEval knowledge-update prompt
    // NOTE: Accepts previous info if updated answer is also present
    case 'knowledge-update':
      return `I will give you a question, a correct answer, and a response from a model. Please answer yes if the response contains the correct answer. Otherwise, answer no. If the response contains some previous information along with an updated answer, the response should be considered as correct as long as the updated answer is the required answer.

Question: ${question}

Correct Answer: ${answer}

Model Response: ${response}

Is the model response correct? Answer yes or no only.`;

    // Official LongMemEval single-session-preference prompt
    // NOTE: More lenient - doesn't require all rubric points
    case 'single-session-preference':
      return `I will give you a question, a rubric for desired personalized response, and a response from a model. Please answer yes if the response satisfies the desired response. Otherwise, answer no. The model does not need to reflect all the points in the rubric. The response is correct as long as it recalls and utilizes the user's personal information correctly.

Question: ${question}

Rubric: ${answer}

Model Response: ${response}

Is the model response correct? Answer yes or no only.`;

    default:
      throw new Error(`Unknown question type: ${taskType}`);
  }
}

/**
 * LongMemEval Scorer implementation using Mastra's scorer framework
 *
 * This scorer evaluates whether an LLM correctly recalls information
 * from long conversation histories across different question types.
 */
export const longMemEvalScorer = createScorer<LongMemEvalInput, LongMemEvalOutput>({
  id: 'longmemeval',
  description: 'Evaluates LLM recall accuracy from long conversation histories',
}).generateScore<number>(() => {
  // This will be called with the judge agent configured at runtime
  // The actual scoring is done in the run function below
  // For the scorer pattern, we need to use judge-based evaluation
  throw new Error('Use createLongMemEvalScorer with a judge agent instead');
});

/**
 * Factory function to create LongMemEval scorer with a specific judge agent
 */
export function createLongMemEvalScorer(judgeAgent: Agent) {
  return createScorer<LongMemEvalInput, LongMemEvalOutput>({
    id: 'longmemeval',
    description: 'Evaluates LLM recall accuracy from long conversation histories',
  })
    .generateScore<number>(async ({ run }) => {
      const { input, output } = run;

      if (!input) {
        throw new Error('Input is required for LongMemEval scorer');
      }

      const { question, answer, questionType, isAbstention = false } = input;
      const response = output.response;

      const prompt = getEvalPrompt(questionType, question, answer, response, isAbstention);

      const judgeResponse = await judgeAgent.generate(
        [
          {
            role: 'user',
            content: prompt,
          },
        ],
        {
          modelSettings: {
            temperature: 0,
          },
        },
      );

      const responseText = judgeResponse.text?.toLowerCase().trim();
      const isCorrect = responseText === 'yes' || responseText?.toLowerCase()?.startsWith('yes.');

      return isCorrect ? 1 : 0;
    })
    .generateReason(async ({ run, score }) => {
      const { input } = run;

      if (!input) {
        return 'No input provided';
      }

      const { questionType, isAbstention = false } = input;

      if (score === 1) {
        return `Model correctly ${isAbstention ? 'identified question as unanswerable' : 'answered the question'} (${questionType})`;
      }

      // For incorrect answers, we could re-evaluate to get the reason
      // but for efficiency, we just return a generic message
      return `Model incorrectly ${isAbstention ? 'failed to identify question as unanswerable' : 'answered the question'} (${questionType})`;
    });
}

/**
 * Legacy interface for backward compatibility
 * Maps the old Metric interface to the new Scorer pattern
 */
export interface LongMemEvalMetricConfig {
  agent: Agent;
  questionType: QuestionType;
  isAbstention?: boolean;
}

/**
 * Legacy class wrapper for backward compatibility
 * @deprecated Use createLongMemEvalScorer instead
 */
export class LongMemEvalMetric {
  private scorer: ReturnType<typeof createLongMemEvalScorer>;
  private questionType: QuestionType;
  private isAbstention: boolean;

  constructor(config: LongMemEvalMetricConfig) {
    if (!config.agent) {
      throw new Error('Agent instance is required for LongMemEvalMetric');
    }
    this.scorer = createLongMemEvalScorer(config.agent);
    this.questionType = config.questionType;
    this.isAbstention = config.isAbstention || false;
  }

  /**
   * Measure the correctness of a model's response
   *
   * @param input - JSON string containing question and expected answer
   * @param output - Model's response
   * @returns MetricResult with score (0 or 1) and additional info
   */
  async measure(input: string, output: string): Promise<{ score: number; info: Record<string, any> }> {
    const { question, answer } = JSON.parse(input) as {
      question: string;
      answer: string;
    };

    const result = await this.scorer.run({
      input: {
        question,
        answer,
        questionType: this.questionType,
        isAbstention: this.isAbstention,
      },
      output: {
        response: output,
      },
    });

    return {
      score: result.score,
      info: {
        questionType: this.questionType,
        isAbstention: this.isAbstention,
        reason: result.reason,
      },
    };
  }
}

/**
 * Factory function to create LongMemEval metrics for different question types
 * @deprecated Use createLongMemEvalScorer instead
 */
export function createLongMemEvalMetric(
  questionType: QuestionType,
  agent: Agent,
  options?: Partial<LongMemEvalMetricConfig>,
): LongMemEvalMetric {
  return new LongMemEvalMetric({
    ...options,
    agent,
    questionType,
  });
}
