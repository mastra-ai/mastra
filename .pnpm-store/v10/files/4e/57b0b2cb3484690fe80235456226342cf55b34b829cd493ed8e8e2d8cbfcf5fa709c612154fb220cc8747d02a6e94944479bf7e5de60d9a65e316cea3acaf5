import type { InferenceSnippet, ModelDataMinimal } from "./types";
import { describe, expect, it } from "vitest";
import { snippetTextGeneration } from "./js";

describe("inference API snippets", () => {
	it("conversational llm", async () => {
		const model: ModelDataMinimal = {
			id: "meta-llama/Llama-3.1-8B-Instruct",
			pipeline_tag: "text-generation",
			tags: ["conversational"],
			inference: "",
		};
		const snippet = snippetTextGeneration(model, "api_token") as InferenceSnippet[];

		expect(snippet[0].content).toEqual(`import { HfInference } from "@huggingface/inference"

const client = new HfInference("api_token")

let out = "";

const stream = client.chatCompletionStream({
	model: "meta-llama/Llama-3.1-8B-Instruct",
	messages: [
		{
			role: "user",
			content: "What is the capital of France?"
		}
	],
	max_tokens: 500
});

for await (const chunk of stream) {
	if (chunk.choices && chunk.choices.length > 0) {
		const newContent = chunk.choices[0].delta.content;
		out += newContent;
		console.log(newContent);
	}  
}`);
	});

	it("conversational vlm", async () => {
		const model: ModelDataMinimal = {
			id: "meta-llama/Llama-3.2-11B-Vision-Instruct",
			pipeline_tag: "image-text-to-text",
			tags: ["conversational"],
			inference: "",
		};
		const snippet = snippetTextGeneration(model, "api_token") as InferenceSnippet[];

		expect(snippet[0].content).toEqual(`import { HfInference } from "@huggingface/inference"

const client = new HfInference("api_token")

let out = "";

const stream = client.chatCompletionStream({
	model: "meta-llama/Llama-3.2-11B-Vision-Instruct",
	messages: [
		{
			role: "user",
			content: [
				{
					type: "text",
					text: "Describe this image in one sentence."
				},
				{
					type: "image_url",
					image_url: {
						url: "https://cdn.britannica.com/61/93061-050-99147DCE/Statue-of-Liberty-Island-New-York-Bay.jpg"
					}
				}
			]
		}
	],
	max_tokens: 500
});

for await (const chunk of stream) {
	if (chunk.choices && chunk.choices.length > 0) {
		const newContent = chunk.choices[0].delta.content;
		out += newContent;
		console.log(newContent);
	}  
}`);
	});
});
