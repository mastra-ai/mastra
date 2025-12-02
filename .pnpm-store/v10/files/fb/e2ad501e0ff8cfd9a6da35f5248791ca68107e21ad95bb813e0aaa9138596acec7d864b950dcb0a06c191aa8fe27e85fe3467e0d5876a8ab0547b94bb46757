import type { ModelData } from "../model-data";

/**
 * Minimal model data required for snippets.
 *
 * Add more fields as needed.
 */
export type ModelDataMinimal = Pick<
	ModelData,
	"id" | "pipeline_tag" | "mask_token" | "library_name" | "config" | "tags" | "inference"
>;

export interface InferenceSnippet {
	content: string;
	client?: string; // for instance: `client` could be `huggingface_hub` or `openai` client for Python snippets
}
