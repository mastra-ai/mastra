import type { MastraLanguageModel } from '@mastra/core/agent';
import type { TitleCombinePrompt, TitleExtractorPrompt } from '../prompts/index.js';
import type { BaseNode } from '../schema/index.js';
import { BaseExtractor } from './base.js';
import type { TitleExtractorsArgs } from './types.js';
type ExtractTitle = {
    documentTitle: string;
};
/**
 * Extract title from a list of nodes.
 */
export declare class TitleExtractor extends BaseExtractor {
    llm: MastraLanguageModel;
    isTextNodeOnly: boolean;
    nodes: number;
    nodeTemplate: TitleExtractorPrompt;
    combineTemplate: TitleCombinePrompt;
    constructor(options?: TitleExtractorsArgs);
    /**
     * Extract titles from a list of nodes.
     * @param {BaseNode[]} nodes Nodes to extract titles from.
     * @returns {Promise<BaseNode<ExtractTitle>[]>} Titles extracted from the nodes.
     */
    extract(nodes: BaseNode[]): Promise<Array<ExtractTitle>>;
    private filterNodes;
    private separateNodesByDocument;
    private extractTitles;
    private getTitlesCandidates;
}
export {};
//# sourceMappingURL=title.d.ts.map