import type { MastraLanguageModel } from '@mastra/core/agent';
import { PromptTemplate, defaultQuestionExtractPrompt, TextNode, BaseExtractor } from 'llamaindex';
import type { QuestionExtractPrompt, BaseNode } from 'llamaindex';
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
  /**
   * MastraLanguageModel instance.
   * @type {MastraLanguageModel}
   */
  llm: MastraLanguageModel;

  /**
   * Number of questions to generate.
   * @type {number}
   * @default 5
   */
  questions: number = 5;

  /**
   * The prompt template to use for the question extractor.
   * @type {string}
   */
  promptTemplate: QuestionExtractPrompt;

  /**
   * Wheter to use metadata for embeddings only
   * @type {boolean}
   * @default false
   */
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
    const text = node.getContent(this.metadataMode);
    if (!text || text.trim() === '') {
      return { questionsThisExcerptCanAnswer: '' };
    }
    if (this.isTextNodeOnly && !(node instanceof TextNode)) {
      return { questionsThisExcerptCanAnswer: '' };
    }

    const contextStr = node.getContent(this.metadataMode);

    const prompt = this.promptTemplate.format({
      context: contextStr,
      numQuestions: this.questions.toString(),
    });

    const questions = await this.llm.doGenerate({
      inputFormat: 'messages',
      mode: { type: 'regular' },
      prompt: [
        {
          role: 'user',
          content: [{ type: 'text', text: prompt }],
        },
      ],
    });

    let result = '';
    try {
      if (typeof questions.text === 'string') {
        result = questions.text.replace(STRIP_REGEX, '').trim();
      } else {
        console.warn('Question extraction LLM output was not a string:', questions.text);
      }
    } catch (err) {
      console.warn('Question extraction failed:', err);
    }
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
