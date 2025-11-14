import { Metric, type MetricResult } from '@mastra/core/eval';
import { Agent } from '@mastra/core/agent';
import type { QuestionType } from '../data/types';

export interface LongMemEvalMetricConfig {
  agent: Agent;
  questionType: QuestionType;
  isAbstention?: boolean;
}

/**
 * LongMemEval Metric implementation using Mastra's eval framework
 *
 * This metric evaluates whether an LLM correctly recalls information
 * from long conversation histories across different question types.
 */
export class LongMemEvalMetric extends Metric {
  private agent: Agent;
  private questionType: QuestionType;
  private isAbstention: boolean;

  constructor(config: LongMemEvalMetricConfig) {
    super();
    this.agent = config.agent;
    if (!this.agent) {
      throw new Error('Agent instance is required for LongMemEvalMetric');
    }
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
  async measure(input: string, output: string): Promise<MetricResult> {
    // Parse input to get question and expected answer
    const { question, answer } = JSON.parse(input) as {
      question: string;
      answer: string;
    };

    const prompt = this.getEvalPrompt(this.questionType, question, answer, output, this.isAbstention);

    try {
      const response = await this.agent.generate(
        [
          {
            role: 'user',
            content: prompt,
          },
        ],
        {
          temperature: 0,
        },
      );

      const responseText = response.text?.toLowerCase().trim();
      const isCorrect = responseText === 'yes' || responseText?.toLowerCase()?.startsWith('yes.');

      // Extract reason if answer is no
      let reason: string | undefined;
      if (!isCorrect && responseText?.includes(':')) {
        reason = responseText.split(':')[1]?.trim();
      }

      return {
        score: isCorrect ? 1 : 0,
        info: {
          questionType: this.questionType,
          isAbstention: this.isAbstention,
          evaluatorResponse: responseText,
          reason,
        },
      };
    } catch (error) {
      throw new Error(`Failed to evaluate response: ${error}`);
    }
  }

  /**
   * Get the evaluation prompt based on question type
   */
  private getEvalPrompt(
    taskType: QuestionType,
    question: string,
    answer: string,
    response: string,
    isAbstention: boolean,
  ): string {
    if (isAbstention) {
      return `I will give you an unanswerable question, an explanation, and a response from a model. Please answer yes if the model correctly identifies the question as unanswerable. The model could say that the information is incomplete, or some other information is given but the asked information is not.

Question: ${question}

Explanation: ${answer}

Model Response: ${response}

Does the model correctly identify the question as unanswerable? Answer yes or no only. If you answer "no" please also include a reason why (ex "no: because x reason")`;
    }

    switch (taskType) {
      case 'single-session-user':
      case 'single-session-assistant':
      case 'multi-session':
        return `I will give you a question, a correct answer, and a response from a model. Please answer yes if the response contains the correct answer. Otherwise, answer no. If the response is equivalent to the correct answer or contains all the intermediate steps to get the correct answer, you should also answer yes. If the response only contains a subset of the information required by the answer, answer no.
If you answer "no" please also include a reason why (ex "no: because x reason")

Question: ${question}

Correct Answer: ${answer}

Model Response: ${response}

Is the model response correct? Answer yes or no only. If you answer "no" please also include a reason why (ex "no: because x reason")`;

      case 'temporal-reasoning':
        return `I will give you a question, a correct answer, and a response from a model. Please answer yes if the response contains the correct answer. Otherwise, answer no. If the response is equivalent to the correct answer or contains all the intermediate steps to get the correct answer, you should also answer yes. If the response only contains a subset of the information required by the answer, answer no. In addition, do not penalize off-by-one errors for the number of days. If the question asks for the number of days/weeks/months, etc., and the model makes off-by-one errors (e.g., predicting 19 days when the answer is 18), the model's response is still correct.

Question: ${question}

Correct Answer: ${answer}

Model Response: ${response}

Is the model response correct? Answer yes or no only. If you answer "no" please also include a reason why (ex "no: because x reason")`;

      case 'knowledge-update':
        return `I will give you a question, a correct answer, and a response from a model. Please answer yes if the response contains the correct answer. Otherwise, answer no. If the response contains some previous information along with an updated answer, the response should be considered as correct as long as the updated answer is the required answer.

Question: ${question}

Correct Answer: ${answer}

Model Response: ${response}

Is the model response correct? Answer yes or no only.`;

      case 'single-session-preference':
        return `I will give you a question, a rubric for desired personalized response, and a response from a model. Please answer yes if the response satisfies the desired response. Otherwise, answer no and provide a reason why. The model does not need to reflect all the points in the rubric. The response is correct as long as it recalls and utilizes the user's personal information correctly.

Question: ${question}

Rubric: ${answer}

Model Response: ${response}

Is the model response correct? Answer yes or no only. If you answer "no" please also include a reason why (ex "no: because x reason")`;

      default:
        throw new Error(`Unknown question type: ${taskType}`);
    }
  }
}

/**
 * Factory function to create LongMemEval metrics for different question types
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
