/**
 * Inference code generated from the JSON schema spec in ./spec
 *
 * Using src/scripts/inference-codegen
 */
/**
 * Inputs for Zero Shot Object Detection inference
 */
export interface ZeroShotObjectDetectionInput {
    /**
     * The input image data, with candidate labels
     */
    inputs: ZeroShotObjectDetectionInputData;
    /**
     * Additional inference parameters
     */
    parameters?: {
        [key: string]: unknown;
    };
    [property: string]: unknown;
}
/**
 * The input image data, with candidate labels
 */
export interface ZeroShotObjectDetectionInputData {
    /**
     * The candidate labels for this image
     */
    candidateLabels: string[];
    /**
     * The image data to generate bounding boxes from
     */
    image: unknown;
    [property: string]: unknown;
}
/**
 * The predicted bounding box. Coordinates are relative to the top left corner of the input
 * image.
 */
export interface BoundingBox {
    xmax: number;
    xmin: number;
    ymax: number;
    ymin: number;
    [property: string]: unknown;
}
export type ZeroShotObjectDetectionOutput = ZeroShotObjectDetectionOutputElement[];
/**
 * Outputs of inference for the Zero Shot Object Detection task
 */
export interface ZeroShotObjectDetectionOutputElement {
    /**
     * The predicted bounding box. Coordinates are relative to the top left corner of the input
     * image.
     */
    box: BoundingBox;
    /**
     * A candidate label
     */
    label: string;
    /**
     * The associated score / probability
     */
    score: number;
    [property: string]: unknown;
}
//# sourceMappingURL=inference.d.ts.map