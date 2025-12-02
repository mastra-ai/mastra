import type { TaskDataCustom } from "..";

const taskData: TaskDataCustom = {
	datasets: [
		{
			// TODO write proper description
			description: "",
			id: "",
		},
	],
	demo: {
		inputs: [
			{
				filename: "image-classification-input.jpeg",
				type: "img",
			},
			{
				label: "Classes",
				content: "cat, dog, bird",
				type: "text",
			},
		],
		outputs: [
			{
				type: "chart",
				data: [
					{
						label: "Cat",
						score: 0.664,
					},
					{
						label: "Dog",
						score: 0.329,
					},
					{
						label: "Bird",
						score: 0.008,
					},
				],
			},
		],
	},
	metrics: [
		{
			description: "Computes the number of times the correct label appears in top K labels predicted",
			id: "top-K accuracy",
		},
	],
	models: [
		{
			description: "Robust image classification model trained on publicly available image-caption data.",
			id: "openai/clip-vit-base-patch16",
		},
		{
			description: "Strong zero-shot image classification model.",
			id: "google/siglip-so400m-patch14-224",
		},
		{
			description: "Small yet powerful zero-shot image classification model that can run on edge devices.",
			id: "apple/MobileCLIP-S1-OpenCLIP",
		},
		{
			description: "Strong image classification model for biomedical domain.",
			id: "microsoft/BiomedCLIP-PubMedBERT_256-vit_base_patch16_224",
		},
	],
	spaces: [
		{
			description:
				"An application that leverages zero-shot image classification to find best captions to generate an image. ",
			id: "pharma/CLIP-Interrogator",
		},
		{
			description: "An application to compare different zero-shot image classification models. ",
			id: "merve/compare_clip_siglip",
		},
	],
	summary:
		"Zero-shot image classification is the task of classifying previously unseen classes during training of a model.",
	widgetModels: ["google/siglip-so400m-patch14-224"],
	youtubeId: "",
};

export default taskData;
