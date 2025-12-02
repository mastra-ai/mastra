import type { SummaryPrompt } from '../prompts/index.js';
import type { BaseNode } from '../schema/index.js';
import { BaseExtractor } from './base.js';
import type { SummaryExtractArgs } from './types.js';
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
export declare class SummaryExtractor extends BaseExtractor {
    private llm;
    summaries: string[];
    promptTemplate: SummaryPrompt;
    private selfSummary;
    private prevSummary;
    private nextSummary;
    constructor(options?: SummaryExtractArgs);
    /**
     * Extract summary from a node.
     * @param {BaseNode} node Node to extract summary from.
     * @returns {Promise<string>} Summary extracted from the node.
     */
    generateNodeSummary(node: BaseNode): Promise<string>;
    /**
     * Extract summaries from a list of nodes.
     * @param {BaseNode[]} nodes Nodes to extract summaries from.
     * @returns {Promise<ExtractSummary[]>} Summaries extracted from the nodes.
     */
    extract(nodes: BaseNode[]): Promise<ExtractSummary[]>;
}
export {};
//# sourceMappingURL=summary.d.ts.map