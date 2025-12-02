import type { TaskDataCustom } from "..";

const taskData: TaskDataCustom = {
	datasets: [
		{
			description: "A large dataset of over 10 million 3D objects.",
			id: "allenai/objaverse-xl",
		},
		{
			description: "A dataset of isolated object images for evaluating image-to-3D models.",
			id: "dylanebert/iso3d",
		},
	],
	demo: {
		inputs: [
			{
				filename: "image-to-3d-image-input.png",
				type: "img",
			},
		],
		outputs: [
			{
				label: "Result",
				content: "image-to-3d-3d-output-filename.glb",
				type: "text",
			},
		],
	},
	metrics: [],
	models: [
		{
			description: "Fast image-to-3D mesh model by Tencent.",
			id: "TencentARC/InstantMesh",
		},
		{
			description: "Fast image-to-3D mesh model by StabilityAI",
			id: "stabilityai/TripoSR",
		},
		{
			description: "A scaled up image-to-3D mesh model derived from TripoSR.",
			id: "hwjiang/Real3D",
		},
		{
			description: "Generative 3D gaussian splatting model.",
			id: "ashawkey/LGM",
		},
	],
	spaces: [
		{
			description: "Leaderboard to evaluate image-to-3D models.",
			id: "dylanebert/3d-arena",
		},
		{
			description: "Image-to-3D demo with mesh outputs.",
			id: "TencentARC/InstantMesh",
		},
		{
			description: "Image-to-3D demo with mesh outputs.",
			id: "stabilityai/TripoSR",
		},
		{
			description: "Image-to-3D demo with mesh outputs.",
			id: "hwjiang/Real3D",
		},
		{
			description: "Image-to-3D demo with splat outputs.",
			id: "dylanebert/LGM-mini",
		},
	],
	summary: "Image-to-3D models take in image input and produce 3D output.",
	widgetModels: [],
	youtubeId: "",
};

export default taskData;
