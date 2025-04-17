import type { MastraLanguageModel } from '@mastra/core/agent';
import { PromptTemplate, defaultKeywordExtractPrompt, MetadataMode, TextNode, BaseExtractor } from 'llamaindex';
import type { KeywordExtractPrompt, BaseNode } from 'llamaindex';
import { baseLLM } from './types';
import type { KeywordExtractArgs } from './types';

type ExtractKeyword = {
  /**
   * Comma-separated keywords extracted from the node. May be empty if extraction fails.
   */
  excerptKeywords: string;
};

/**
 * Extract keywords from a list of nodes.
 */
export class KeywordExtractor extends BaseExtractor {
  /**
   * MastraLanguageModel instance.
   * @type {MastraLanguageModel}
   */
  llm: MastraLanguageModel;

  /**
   * Number of keywords to extract.
   * @type {number}
   * @default 5
   */
  keywords: number = 5;

  /**
   * The prompt template to use for the question extractor.
   * @type {string}
   */
  promptTemplate: KeywordExtractPrompt;

  /**
   * Constructor for the KeywordExtractor class.
   * @param {MastraLanguageModel} llm MastraLanguageModel instance.
   * @param {number} keywords Number of keywords to extract.
   * @param {string} [promptTemplate] Optional custom prompt template (must include {context})
   * @throws {Error} If keywords is less than 1.
   */
  constructor(options?: KeywordExtractArgs) {
    if (options?.keywords && options.keywords < 1) throw new Error('Keywords must be greater than 0');

    super();

    this.llm = options?.llm ?? baseLLM;
    this.keywords = options?.keywords ?? 5;
    this.promptTemplate = options?.promptTemplate
      ? new PromptTemplate({
          templateVars: ['context', 'maxKeywords'],
          template: options.promptTemplate,
        })
      : defaultKeywordExtractPrompt;
  }

  /**
   *
   * @param node Node to extract keywords from.
   * @returns Keywords extracted from the node.
   */
  /**
   * Extract keywords from a node. Returns an object with a comma-separated string of keywords, or an empty string if extraction fails.
   * Adds error handling for malformed/empty LLM output.
   */
  async extractKeywordsFromNodes(node: BaseNode): Promise<ExtractKeyword> {
    const text = node.getContent(this.metadataMode);
    if (!text || text.trim() === '') {
      return { excerptKeywords: '' };
    }
    if (this.isTextNodeOnly && !(node instanceof TextNode)) {
      return { excerptKeywords: '' };
    }

    let keywords = '';
    try {
      const completion = await this.llm.doGenerate({
        inputFormat: 'messages',
        mode: { type: 'regular' },
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: this.promptTemplate.format({
                  context: node.getContent(MetadataMode.ALL),
                  maxKeywords: this.keywords.toString(),
                }),
              },
            ],
          },
        ],
      });
      if (typeof completion.text === 'string') {
        keywords = completion.text.trim();
      } else {
        console.warn('Keyword extraction LLM output was not a string:', completion.text);
      }
    } catch (err) {
      console.warn('Keyword extraction failed:', err);
    }
    return { excerptKeywords: keywords };
  }

  /**
   *
   * @param nodes Nodes to extract keywords from.
   * @returns Keywords extracted from the nodes.
   */
  /**
   * Extract keywords from an array of nodes. Always returns an array (may be empty).
   * @param nodes Nodes to extract keywords from.
   * @returns Array of keyword extraction results.
   */
  async extract(nodes: BaseNode[]): Promise<Array<ExtractKeyword>> {
    if (!Array.isArray(nodes) || nodes.length === 0) return [];
    const results = await Promise.all(nodes.map(node => this.extractKeywordsFromNodes(node)));
    return results;
  }
}
