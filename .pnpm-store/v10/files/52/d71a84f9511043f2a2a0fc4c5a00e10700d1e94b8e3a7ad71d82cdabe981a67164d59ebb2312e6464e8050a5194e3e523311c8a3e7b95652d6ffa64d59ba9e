/**
 * Inference code generated from the JSON schema spec in ./spec
 *
 * Using src/scripts/inference-codegen
 */
/**
 * Inputs for Zero Shot Image Classification inference
 */
export interface ZeroShotImageClassificationInput {
    /**
     * The input image data, with candidate labels
     */
    inputs: ZeroShotImageClassificationInputData;
    /**
     * Additional inference parameters
     */
    parameters?: ZeroShotImageClassificationParameters;
    [property: string]: unknown;
}
/**
 * The input image data, with candidate labels
 */
export interface ZeroShotImageClassificationInputData {
    /**
     * The candidate labels for this image
     */
    candidateLabels: string[];
    /**
     * The image data to classify
     */
    image: unknown;
    [property: string]: unknown;
}
/**
 * Additional inference parameters
 *
 * Additional inference parameters for Zero Shot Image Classification
 */
export interface ZeroShotImageClassificationParameters {
    /**
     * The sentence used in conjunction with candidateLabels to attempt the text classification
     * by replacing the placeholder with the candidate labels.
     */
    hypothesis_template?: string;
    [property: string]: unknown;
}
export type ZeroShotImageClassificationOutput = ZeroShotImageClassificationOutputElement[];
/**
 * Outputs of inference for the Zero Shot Image Classification task
 */
export interface ZeroShotImageClassificationOutputElement {
    /**
     * The predicted class label.
     */
    label: string;
    /**
     * The corresponding probability.
     */
    score: number;
    [property: string]: unknown;
}
//# sourceMappingURL=inference.d.ts.map