import type { MastraLanguageModel } from '@mastra/core/agent';
import {
  PromptTemplate,
  defaultTitleCombinePromptTemplate,
  defaultTitleExtractorPromptTemplate,
  MetadataMode,
  TextNode,
  BaseExtractor,
} from 'llamaindex';
import type { TitleCombinePrompt, TitleExtractorPrompt, BaseNode } from 'llamaindex';
import { baseLLM } from './types';
import type { TitleExtractorsArgs } from './types';

type ExtractTitle = {
  documentTitle: string;
};

/**
 * Extract title from a list of nodes.
 */
export class TitleExtractor extends BaseExtractor {
  /**
   * MastraLanguageModel instance.
   * @type {MastraLanguageModel}
   */
  llm: MastraLanguageModel;

  /**
   * Can work for mixture of text and non-text nodes
   * @type {boolean}
   * @default false
   */
  isTextNodeOnly: boolean = false;

  /**
   * Number of nodes to extrct titles from.
   * @type {number}
   * @default 5
   */
  nodes: number = 5;

  /**
   * The prompt template to use for the title extractor.
   * @type {string}
   */
  nodeTemplate: TitleExtractorPrompt;

  /**
   * The prompt template to merge title with..
   * @type {string}
   */
  combineTemplate: TitleCombinePrompt;

  /**
   * Constructor for the TitleExtractor class.
   * @param {MastraLanguageModel} llm MastraLanguageModel instance.
   * @param {number} nodes Number of nodes to extract titles from.
   * @param {TitleExtractorPrompt} nodeTemplate The prompt template to use for the title extractor.
   * @param {string} combineTemplate The prompt template to merge title with..
   */
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
      const text = node.getContent(this.metadataMode);
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
      const completion = await this.llm.doGenerate({
        inputFormat: 'messages',
        mode: { type: 'regular' },
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: this.combineTemplate.format({
                  context: combinedTitles,
                }),
              },
            ],
          },
        ],
      });

      let title = '';
      if (typeof completion.text === 'string') {
        title = completion.text.trim();
      } else {
        console.warn('Title extraction LLM output was not a string:', completion.text);
      }
      titlesByDocument[key] = title;
    }

    return titlesByDocument;
  }

  private async getTitlesCandidates(nodes: BaseNode[]): Promise<string[]> {
    const titleJobs = nodes.map(async node => {
      const completion = await this.llm.doGenerate({
        inputFormat: 'messages',
        mode: { type: 'regular' },
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: this.nodeTemplate.format({
                  context: node.getContent(MetadataMode.ALL),
                }),
              },
            ],
          },
        ],
      });

      if (typeof completion.text === 'string') {
        return completion.text.trim();
      } else {
        console.warn('Title candidate extraction LLM output was not a string:', completion.text);
        return '';
      }
    });

    return await Promise.all(titleJobs);
  }
}
