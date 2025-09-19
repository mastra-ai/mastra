import { Agent } from '@mastra/core/agent';
import type { MastraLanguageModel } from '@mastra/core/agent';
import { PromptTemplate, defaultQuestionExtractPrompt } from '../prompts';
import type { QuestionExtractPrompt } from '../prompts';
import type { BaseNode } from '../schema';
import { TextNode } from '../schema';
import { BaseExtractor } from './base';
import { baseLLM, STRIP_REGEX } from './types';
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
   * @param {MastraLanguageModel} llm MastraLanguageModel instance.
   * @param {number} questions Number of questions to generate.
   * @param {QuestionExtractPrompt['template']} promptTemplate Optional custom prompt template (should include {context}).
   * @param {boolean} embeddingOnly Whether to use metadata for embeddings only.
   */
  constructor(options?: QuestionAnswerExtractArgs) {
    if (options?.questions && options.questions < 1) throw new Error('Questions must be greater than 0');

    super();

    this.llm = options?.llm ?? baseLLM;
    this.questions = options?.questions ?? 5;
    this.promptTemplate = options?.promptTemplate
      ? new PromptTemplate({
          templateVars: ['numQuestions', 'context'],
          template: options.promptTemplate,
        }).partialFormat({
          numQuestions: '5',
        })
      : defaultQuestionExtractPrompt;
    this.embeddingOnly = options?.embeddingOnly ?? false;
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

    const miniAgent = new Agent({
      model: this.llm,
      name: 'question-extractor',
      instructions:
        'You are a question extractor. You are given a node and you need to extract the questions from the node.',
    });

    let questionsText = '';
    if (this.llm.specificationVersion === 'v2') {
      const result = await miniAgent.generateVNext([{ role: 'user', content: prompt }], { format: 'mastra' });
      questionsText = result.text;
    } else {
      const result = await miniAgent.generate([{ role: 'user', content: prompt }]);
      questionsText = result.text;
    }

    if (!questionsText) {
      console.warn('Question extraction LLM output returned empty');
      return { questionsThisExcerptCanAnswer: '' };
    }

    const result = questionsText.replace(STRIP_REGEX, '').trim();

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
