import type { TaskDataCustom } from "..";

const taskData: TaskDataCustom = {
	datasets: [
		{
			description: "Multiple-choice questions and answers about videos.",
			id: "lmms-lab/Video-MME",
		},
		{
			description: "A dataset of instructions and question-answer pairs about videos.",
			id: "lmms-lab/VideoChatGPT",
		},
		{
			description: "Large video understanding dataset.",
			id: "HuggingFaceFV/finevideo",
		},
	],
	demo: {
		inputs: [
			{
				filename: "video-text-to-text-input.gif",
				type: "img",
			},
			{
				label: "Text Prompt",
				content: "What is happening in this video?",
				type: "text",
			},
		],
		outputs: [
			{
				label: "Answer",
				content:
					"The video shows a series of images showing a fountain with water jets and a variety of colorful flowers and butterflies in the background.",
				type: "text",
			},
		],
	},
	metrics: [],
	models: [
		{
			description: "A robust video-text-to-text model that can take in image and video inputs.",
			id: "llava-hf/llava-onevision-qwen2-72b-ov-hf",
		},
		{
			description: "Large and powerful video-text-to-text model that can take in image and video inputs.",
			id: "llava-hf/LLaVA-NeXT-Video-34B-hf",
		},
	],
	spaces: [
		{
			description: "An application to chat with a video-text-to-text model.",
			id: "llava-hf/video-llava",
		},
		{
			description: "A leaderboard for various video-text-to-text models.",
			id: "opencompass/openvlm_video_leaderboard",
		},
	],
	summary:
		"Video-text-to-text models take in a video and a text prompt and output text. These models are also called video-language models.",
	widgetModels: [""],
	youtubeId: "",
};

export default taskData;
