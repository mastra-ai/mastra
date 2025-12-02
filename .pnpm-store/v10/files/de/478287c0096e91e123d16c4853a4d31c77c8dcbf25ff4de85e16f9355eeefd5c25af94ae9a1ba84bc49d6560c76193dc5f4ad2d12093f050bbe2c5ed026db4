/**
 * Inference code generated from the JSON schema spec in ./spec
 *
 * Using src/scripts/inference-codegen
 */
/**
 * Inputs for Table Question Answering inference
 */
export interface TableQuestionAnsweringInput {
    /**
     * One (table, question) pair to answer
     */
    inputs: TableQuestionAnsweringInputData;
    /**
     * Additional inference parameters
     */
    parameters?: {
        [key: string]: unknown;
    };
    [property: string]: unknown;
}
/**
 * One (table, question) pair to answer
 */
export interface TableQuestionAnsweringInputData {
    /**
     * The question to be answered about the table
     */
    question: string;
    /**
     * The table to serve as context for the questions
     */
    table: {
        [key: string]: string[];
    };
    [property: string]: unknown;
}
export type TableQuestionAnsweringOutput = TableQuestionAnsweringOutputElement[];
/**
 * Outputs of inference for the Table Question Answering task
 */
export interface TableQuestionAnsweringOutputElement {
    /**
     * If the model has an aggregator, this returns the aggregator.
     */
    aggregator?: string;
    /**
     * The answer of the question given the table. If there is an aggregator, the answer will be
     * preceded by `AGGREGATOR >`.
     */
    answer: string;
    /**
     * List of strings made up of the answer cell values.
     */
    cells: string[];
    /**
     * Coordinates of the cells of the answers.
     */
    coordinates: Array<number[]>;
    [property: string]: unknown;
}
//# sourceMappingURL=inference.d.ts.map