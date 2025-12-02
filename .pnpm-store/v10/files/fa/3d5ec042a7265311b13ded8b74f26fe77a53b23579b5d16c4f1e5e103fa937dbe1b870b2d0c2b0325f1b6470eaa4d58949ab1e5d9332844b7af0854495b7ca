import type { MastraLanguageModel } from '@mastra/core/agent';
import type { KeywordExtractPrompt } from '../prompts/index.js';
import type { BaseNode } from '../schema/index.js';
import { BaseExtractor } from './base.js';
import type { KeywordExtractArgs } from './types.js';
type ExtractKeyword = {
    /**
     * Comma-separated keywords extracted from the node. May be empty if extraction fails.
     */
    excerptKeywords: string;
};
/**
 * Extract keywords from a list of nodes.
 */
export declare class KeywordExtractor extends BaseExtractor {
    llm: MastraLanguageModel;
    keywords: number;
    promptTemplate: KeywordExtractPrompt;
    /**
     * Constructor for the KeywordExtractor class.
     * @param {MastraLanguageModel} llm MastraLanguageModel instance.
     * @param {number} keywords Number of keywords to extract.
     * @param {string} [promptTemplate] Optional custom prompt template (must include {context})
     * @throws {Error} If keywords is less than 1.
     */
    constructor(options?: KeywordExtractArgs);
    /**
     *
     * @param node Node to extract keywords from.
     * @returns Keywords extracted from the node.
     */
    /**
     * Extract keywords from a node. Returns an object with a comma-separated string of keywords, or an empty string if extraction fails.
     * Adds error handling for malformed/empty LLM output.
     */
    extractKeywordsFromNodes(node: BaseNode): Promise<ExtractKeyword>;
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
    extract(nodes: BaseNode[]): Promise<Array<ExtractKeyword>>;
}
export {};
//# sourceMappingURL=keywords.d.ts.map