import { Agent } from '@mastra/core/agent';
import type { MastraLanguageModel } from '@mastra/core/agent';
import { defaultTitleCombinePromptTemplate, defaultTitleExtractorPromptTemplate, PromptTemplate } from '../prompts';
import type { TitleCombinePrompt, TitleExtractorPrompt } from '../prompts';
import { TextNode } from '../schema';
import type { BaseNode } from '../schema';
import { BaseExtractor } from './base';
import { baseLLM } from './types';
import type { TitleExtractorsArgs } from './types';

type ExtractTitle = {
  documentTitle: string;
};

/**
 * Extract title from a list of nodes.
 */
export class TitleExtractor extends BaseExtractor {
  llm: MastraLanguageModel;
  isTextNodeOnly: boolean = false;
  nodes: number = 5;
  nodeTemplate: TitleExtractorPrompt;
  combineTemplate: TitleCombinePrompt;

  constructor(options?: TitleExtractorsArgs) {
    super();

    this.llm = options?.llm ?? baseLLM;
    this.nodes = options?.nodes ?? 5;

    this.nodeTemplate = options?.nodeTemplate
      ? new PromptTemplate({
          templateVars: ['context'],
          template: options.nodeTemplate,
        })
      : defaultTitleExtractorPromptTemplate;

    this.combineTemplate = options?.combineTemplate
      ? new PromptTemplate({
          templateVars: ['context'],
          template: options.combineTemplate,
        })
      : defaultTitleCombinePromptTemplate;
  }

  /**
   * Extract titles from a list of nodes.
   * @param {BaseNode[]} nodes Nodes to extract titles from.
   * @returns {Promise<BaseNode<ExtractTitle>[]>} Titles extracted from the nodes.
   */
  async extract(nodes: BaseNode[]): Promise<Array<ExtractTitle>> {
    // Prepare output array in original node order
    const results: ExtractTitle[] = new Array(nodes.length);
    // Keep track of nodes with content to extract
    const nodesToExtractTitle: BaseNode[] = [];
    const nodeIndexes: number[] = [];

    nodes.forEach((node, idx) => {
      const text = node.getContent();
      if (!text || text.trim() === '') {
        results[idx] = { documentTitle: '' };
      } else {
        nodesToExtractTitle.push(node);
        nodeIndexes.push(idx);
      }
    });

    if (nodesToExtractTitle.length) {
      const filteredNodes = this.filterNodes(nodesToExtractTitle);
      if (filteredNodes.length) {
        const nodesByDocument = this.separateNodesByDocument(filteredNodes);
        const titlesByDocument = await this.extractTitles(nodesByDocument);
        filteredNodes.forEach((node, i) => {
          const nodeIndex = nodeIndexes[i];
          const groupKey = node.sourceNode?.nodeId ?? node.id_;
          if (typeof nodeIndex === 'number') {
            results[nodeIndex] = {
              documentTitle: titlesByDocument[groupKey] ?? '',
            };
          }
        });
      }
    }
    return results;
  }

  private filterNodes(nodes: BaseNode[]): BaseNode[] {
    return nodes.filter(node => {
      if (this.isTextNodeOnly && !(node instanceof TextNode)) {
        return false;
      }
      return true;
    });
  }

  private separateNodesByDocument(nodes: BaseNode[]): Record<string, BaseNode[]> {
    const nodesByDocument: Record<string, BaseNode[]> = {};

    for (const node of nodes) {
      const groupKey = node.sourceNode?.nodeId ?? node.id_;
      nodesByDocument[groupKey] = nodesByDocument[groupKey] || [];
      nodesByDocument[groupKey].push(node);
    }

    return nodesByDocument;
  }

  private async extractTitles(nodesByDocument: Record<string, BaseNode[]>): Promise<Record<string, string>> {
    const titlesByDocument: Record<string, string> = {};

    for (const [key, nodes] of Object.entries(nodesByDocument)) {
      const titleCandidates = await this.getTitlesCandidates(nodes);
      const combinedTitles = titleCandidates.join(', ');

      let title = '';

      if (this.llm.specificationVersion === 'v2') {
        const miniAgent = new Agent({
          model: this.llm,
          name: 'title-extractor',
          instructions:
            'You are a title extractor. You are given a list of nodes and you need to extract the title from the nodes.',
        });
        const result = await miniAgent.generateVNext(
          [{ role: 'user', content: this.combineTemplate.format({ context: combinedTitles }) }],
          { format: 'mastra' },
        );
        title = result.text;
      } else {
        const miniAgent = new Agent({
          model: this.llm,
          name: 'title-extractor',
          instructions:
            'You are a title extractor. You are given a list of nodes and you need to extract the title from the nodes.',
        });
        const result = await miniAgent.generate([
          { role: 'user', content: this.combineTemplate.format({ context: combinedTitles }) },
        ]);
        title = result.text;
      }

      if (!title) {
        console.warn('Title extraction LLM output returned empty');
      }

      titlesByDocument[key] = title;
    }

    return titlesByDocument;
  }

  private async getTitlesCandidates(nodes: BaseNode[]): Promise<string[]> {
    const miniAgent = new Agent({
      model: this.llm,
      name: 'titles-candidates-extractor',
      instructions:
        'You are a titles candidates extractor. You are given a list of nodes and you need to extract the titles candidates from the nodes.',
    });

    const titleJobs = nodes.map(async node => {
      let completion: string;
      if (this.llm.specificationVersion === 'v2') {
        const result = await miniAgent.generateVNext(
          [{ role: 'user', content: this.nodeTemplate.format({ context: node.getContent() }) }],
          { format: 'mastra' },
        );
        completion = result.text;
      } else {
        const result = await miniAgent.generate([
          { role: 'user', content: this.nodeTemplate.format({ context: node.getContent() }) },
        ]);
        completion = result.text;
      }

      if (!completion) {
        console.warn('Title candidate extraction LLM output returned empty');
        return '';
      }

      return completion.trim();
    });

    return await Promise.all(titleJobs);
  }
}
