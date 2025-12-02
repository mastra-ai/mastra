/**
 * Inference code generated from the JSON schema spec in ./spec
 *
 * Using src/scripts/inference-codegen
 */
/**
 * Inputs for Text2text Generation inference
 */
export interface Text2TextGenerationInput {
    /**
     * The input text data
     */
    inputs: string;
    /**
     * Additional inference parameters
     */
    parameters?: Text2TextGenerationParameters;
    [property: string]: unknown;
}
/**
 * Additional inference parameters
 *
 * Additional inference parameters for Text2text Generation
 */
export interface Text2TextGenerationParameters {
    /**
     * Whether to clean up the potential extra spaces in the text output.
     */
    clean_up_tokenization_spaces?: boolean;
    /**
     * Additional parametrization of the text generation algorithm
     */
    generate_parameters?: {
        [key: string]: unknown;
    };
    /**
     * The truncation strategy to use
     */
    truncation?: Text2TextGenerationTruncationStrategy;
    [property: string]: unknown;
}
export type Text2TextGenerationTruncationStrategy = "do_not_truncate" | "longest_first" | "only_first" | "only_second";
/**
 * Outputs of inference for the Text2text Generation task
 */
export interface Text2TextGenerationOutput {
    generatedText: unknown;
    /**
     * The generated text.
     */
    generated_text?: string;
    [property: string]: unknown;
}
//# sourceMappingURL=inference.d.ts.map