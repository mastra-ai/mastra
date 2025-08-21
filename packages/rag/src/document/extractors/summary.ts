import { Agent } from '@mastra/core/agent';
import type { MastraLanguageModel } from '@mastra/core/agent';
import { PromptTemplate, defaultSummaryPrompt } from '../prompts';
import type { SummaryPrompt } from '../prompts';
import type { BaseNode } from '../schema';
import { TextNode } from '../schema';
import { BaseExtractor } from './base';
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
  private llm: MastraLanguageModel;
  summaries: string[];
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
    const text = node.getContent();
    if (!text || text.trim() === '') {
      return '';
    }
    if (this.isTextNodeOnly && !(node instanceof TextNode)) {
      return '';
    }
    const context = node.getContent();

    const prompt = this.promptTemplate.format({
      context,
    });

    const miniAgent = new Agent({
      model: this.llm,
      name: 'summary-extractor',
      instructions:
        'You are a summary extractor. You are given a node and you need to extract the summary from the node.',
    });

    let summary = '';
    if (this.llm.specificationVersion === 'v2') {
      const result = await miniAgent.generateVNext([{ role: 'user', content: prompt }], { format: 'mastra' });
      summary = result.text;
    } else {
      const result = await miniAgent.generate([{ role: 'user', content: prompt }]);
      summary = result.text;
    }

    if (!summary) {
      console.warn('Summary extraction LLM output returned empty');
      return '';
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
