import type { MastraLanguageModel } from '@mastra/core/agent';
import { generateText } from 'ai';
import { PromptTemplate, defaultQuestionExtractPrompt } from '../prompts';
import type { QuestionExtractPrompt } from '../prompts';
import type { BaseNode } from '../schema';
import { TextNode } from '../schema';
import { BaseExtractor } from './base';
import { STRIP_REGEX } from './types';
import type { QuestionAnswerExtractArgs } from './types';

type ExtractQuestion = {
  /**
   * Questions extracted from the node as a string (may be empty if extraction fails).
   */
  questionsThisExcerptCanAnswer: string;
};

/**
 * Extract questions from a list of nodes.
 */
export class QuestionsAnsweredExtractor extends BaseExtractor {
  llm: MastraLanguageModel;
  questions: number = 5;
  promptTemplate: QuestionExtractPrompt;
  embeddingOnly: boolean = false;

  /**
   * Constructor for the QuestionsAnsweredExtractor class.
   * @param {QuestionAnswerExtractArgs} options Configuration options including required llm instance.
   */
  constructor(options: QuestionAnswerExtractArgs) {
    if (options.questions && options.questions < 1) throw new Error('Questions must be greater than 0');

    super();

    this.llm = options.llm;
    this.questions = options.questions ?? 5;
    this.promptTemplate = options.promptTemplate
      ? new PromptTemplate({
          templateVars: ['numQuestions', 'context'],
          template: options.promptTemplate,
        }).partialFormat({
          numQuestions: '5',
        })
      : defaultQuestionExtractPrompt;
    this.embeddingOnly = options.embeddingOnly ?? false;
  }

  /**
   * Extract answered questions from a node.
   * @param {BaseNode} node Node to extract questions from.
   * @returns {Promise<Array<ExtractQuestion> | Array<{}>>} Questions extracted from the node.
   */
  async extractQuestionsFromNode(node: BaseNode): Promise<ExtractQuestion> {
    const text = node.getContent();
    if (!text || text.trim() === '') {
      return { questionsThisExcerptCanAnswer: '' };
    }
    if (this.isTextNodeOnly && !(node instanceof TextNode)) {
      return { questionsThisExcerptCanAnswer: '' };
    }

    const contextStr = node.getContent();

    const prompt = this.promptTemplate.format({
      context: contextStr,
      numQuestions: this.questions.toString(),
    });

    const response = await generateText({
      model: this.llm,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const result = response.text.replace(STRIP_REGEX, '').trim();

    return {
      questionsThisExcerptCanAnswer: result,
    };
  }

  /**
   * Extract answered questions from a list of nodes.
   * @param {BaseNode[]} nodes Nodes to extract questions from.
   * @returns {Promise<Array<ExtractQuestion> | Array<{}>>} Questions extracted from the nodes.
   */
  async extract(nodes: BaseNode[]): Promise<Array<ExtractQuestion> | Array<object>> {
    const results = await Promise.all(nodes.map(node => this.extractQuestionsFromNode(node)));

    return results;
  }
}
