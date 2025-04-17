import type { MastraLanguageModel } from '@mastra/core/agent';
import { PromptTemplate, defaultSummaryPrompt, TextNode, BaseExtractor } from 'llamaindex';
import type { SummaryPrompt, BaseNode } from 'llamaindex';
import { baseLLM, STRIP_REGEX } from './types';
import type { SummaryExtractArgs } from './types';

type ExtractSummary = {
  sectionSummary?: string;
  prevSectionSummary?: string;
  nextSectionSummary?: string;
};

/**
 * Summarize an array of nodes using a custom LLM.
 *
 * @param nodes Array of node-like objects
 * @param options Summary extraction options
 * @returns Array of summary results
 */
export class SummaryExtractor extends BaseExtractor {
  /**
   * MastraLanguageModel instance.
   * @type {MastraLanguageModel}
   */
  private llm: MastraLanguageModel;
  /**
   * List of summaries to extract: 'self', 'prev', 'next'
   * @type {string[]}
   */
  summaries: string[];

  /**
   * The prompt template to use for the summary extractor.
   * @type {string}
   */
  promptTemplate: SummaryPrompt;

  private selfSummary: boolean;
  private prevSummary: boolean;
  private nextSummary: boolean;

  constructor(options?: SummaryExtractArgs) {
    const summaries = options?.summaries ?? ['self'];

    if (summaries && !summaries.some(s => ['self', 'prev', 'next'].includes(s)))
      throw new Error("Summaries must be one of 'self', 'prev', 'next'");

    super();

    this.llm = options?.llm ?? baseLLM;
    this.summaries = summaries;
    this.promptTemplate = options?.promptTemplate
      ? new PromptTemplate({
          templateVars: ['context'],
          template: options.promptTemplate,
        })
      : defaultSummaryPrompt;

    this.selfSummary = summaries?.includes('self') ?? false;
    this.prevSummary = summaries?.includes('prev') ?? false;
    this.nextSummary = summaries?.includes('next') ?? false;
  }

  /**
   * Extract summary from a node.
   * @param {BaseNode} node Node to extract summary from.
   * @returns {Promise<string>} Summary extracted from the node.
   */
  async generateNodeSummary(node: BaseNode): Promise<string> {
    const text = node.getContent(this.metadataMode);
    if (!text || text.trim() === '') {
      return '';
    }
    if (this.isTextNodeOnly && !(node instanceof TextNode)) {
      return '';
    }
    const context = node.getContent(this.metadataMode);

    const prompt = this.promptTemplate.format({
      context,
    });

    const result = await this.llm.doGenerate({
      inputFormat: 'messages',
      mode: { type: 'regular' },
      prompt: [
        {
          role: 'user',
          content: [{ type: 'text', text: prompt }],
        },
      ],
    });

    let summary = '';
    if (typeof result.text === 'string') {
      summary = result.text.trim();
    } else {
      console.warn('Summary extraction LLM output was not a string:', result.text);
    }

    return summary.replace(STRIP_REGEX, '');
  }

  /**
   * Extract summaries from a list of nodes.
   * @param {BaseNode[]} nodes Nodes to extract summaries from.
   * @returns {Promise<ExtractSummary[]>} Summaries extracted from the nodes.
   */
  async extract(nodes: BaseNode[]): Promise<ExtractSummary[]> {
    if (!nodes.every(n => n instanceof TextNode)) throw new Error('Only `TextNode` is allowed for `Summary` extractor');

    const nodeSummaries = await Promise.all(nodes.map(node => this.generateNodeSummary(node)));

    const metadataList: ExtractSummary[] = nodes.map(() => ({}));

    for (let i = 0; i < nodes.length; i++) {
      if (i > 0 && this.prevSummary && nodeSummaries[i - 1]) {
        metadataList[i]!['prevSectionSummary'] = nodeSummaries[i - 1];
      }
      if (i < nodes.length - 1 && this.nextSummary && nodeSummaries[i + 1]) {
        metadataList[i]!['nextSectionSummary'] = nodeSummaries[i + 1];
      }
      if (this.selfSummary && nodeSummaries[i]) {
        metadataList[i]!['sectionSummary'] = nodeSummaries[i];
      }
    }

    return metadataList;
  }
}
