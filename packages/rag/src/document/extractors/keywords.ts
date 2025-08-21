import { Agent } from '@mastra/core/agent';
import type { MastraLanguageModel } from '@mastra/core/agent';
import { defaultKeywordExtractPrompt, PromptTemplate } from '../prompts';
import type { KeywordExtractPrompt } from '../prompts';
import type { BaseNode } from '../schema';
import { TextNode } from '../schema';
import { BaseExtractor } from './base';
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
  llm: MastraLanguageModel;
  keywords: number = 5;
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
    const text = node.getContent();
    if (!text || text.trim() === '') {
      return { excerptKeywords: '' };
    }
    if (this.isTextNodeOnly && !(node instanceof TextNode)) {
      return { excerptKeywords: '' };
    }

    let keywords = '';
    try {
      const miniAgent = new Agent({
        model: this.llm,
        name: 'keyword-extractor',
        instructions:
          'You are a keyword extractor. You are given a node and you need to extract the keywords from the node.',
      });

      if (this.llm.specificationVersion === 'v2') {
        const result = await miniAgent.generateVNext(
          [
            {
              role: 'user',
              content: this.promptTemplate.format({
                context: node.getContent(),
                maxKeywords: this.keywords.toString(),
              }),
            },
          ],
          { format: 'mastra' },
        );
        keywords = result.text;
      } else {
        const result = await miniAgent.generate([
          {
            role: 'user',
            content: this.promptTemplate.format({ context: node.getContent(), maxKeywords: this.keywords.toString() }),
          },
        ]);
        keywords = result.text;
      }

      if (!keywords) {
        console.warn('Keyword extraction LLM output returned empty');
        return { excerptKeywords: '' };
      }

      return { excerptKeywords: keywords.trim() };
    } catch (err) {
      console.warn('Keyword extraction failed:', err);
      return { excerptKeywords: '' };
    }
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
