import type { MastraLanguageModel } from '@mastra/core/agent';
import type { QuestionExtractPrompt } from '../prompts/index.js';
import type { BaseNode } from '../schema/index.js';
import { BaseExtractor } from './base.js';
import type { QuestionAnswerExtractArgs } from './types.js';
type ExtractQuestion = {
    /**
     * Questions extracted from the node as a string (may be empty if extraction fails).
     */
    questionsThisExcerptCanAnswer: string;
};
/**
 * Extract questions from a list of nodes.
 */
export declare class QuestionsAnsweredExtractor extends BaseExtractor {
    llm: MastraLanguageModel;
    questions: number;
    promptTemplate: QuestionExtractPrompt;
    embeddingOnly: boolean;
    /**
     * Constructor for the QuestionsAnsweredExtractor class.
     * @param {MastraLanguageModel} llm MastraLanguageModel instance.
     * @param {number} questions Number of questions to generate.
     * @param {QuestionExtractPrompt['template']} promptTemplate Optional custom prompt template (should include {context}).
     * @param {boolean} embeddingOnly Whether to use metadata for embeddings only.
     */
    constructor(options?: QuestionAnswerExtractArgs);
    /**
     * Extract answered questions from a node.
     * @param {BaseNode} node Node to extract questions from.
     * @returns {Promise<Array<ExtractQuestion> | Array<{}>>} Questions extracted from the node.
     */
    extractQuestionsFromNode(node: BaseNode): Promise<ExtractQuestion>;
    /**
     * Extract answered questions from a list of nodes.
     * @param {BaseNode[]} nodes Nodes to extract questions from.
     * @returns {Promise<Array<ExtractQuestion> | Array<{}>>} Questions extracted from the nodes.
     */
    extract(nodes: BaseNode[]): Promise<Array<ExtractQuestion> | Array<object>>;
}
export {};
//# sourceMappingURL=questions.d.ts.map