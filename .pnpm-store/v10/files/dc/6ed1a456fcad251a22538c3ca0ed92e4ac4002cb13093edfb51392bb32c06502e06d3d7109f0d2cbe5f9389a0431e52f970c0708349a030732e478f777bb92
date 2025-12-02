import type { TaskDataCustom } from "..";

const taskData: TaskDataCustom = {
	datasets: [
		{
			description: "Widely used benchmark dataset for multiple vision tasks.",
			id: "merve/coco2017",
		},
		{
			description: "Multi-task computer vision benchmark.",
			id: "merve/pascal-voc",
		},
	],
	demo: {
		inputs: [
			{
				filename: "object-detection-input.jpg",
				type: "img",
			},
		],
		outputs: [
			{
				filename: "object-detection-output.jpg",
				type: "img",
			},
		],
	},
	metrics: [
		{
			description:
				"The Average Precision (AP) metric is the Area Under the PR Curve (AUC-PR). It is calculated for each class separately",
			id: "Average Precision",
		},
		{
			description: "The Mean Average Precision (mAP) metric is the overall average of the AP values",
			id: "Mean Average Precision",
		},
		{
			description:
				"The APα metric is the Average Precision at the IoU threshold of a α value, for example, AP50 and AP75",
			id: "APα",
		},
	],
	models: [
		{
			description: "Solid object detection model pre-trained on the COCO 2017 dataset.",
			id: "facebook/detr-resnet-50",
		},
		{
			description: "Real-time and accurate object detection model.",
			id: "jameslahm/yolov10x",
		},
		{
			description: "Fast and accurate object detection model trained on COCO and Object365 datasets.",
			id: "PekingU/rtdetr_r18vd_coco_o365",
		},
	],
	spaces: [
		{
			description: "Leaderboard to compare various object detection models across several metrics.",
			id: "hf-vision/object_detection_leaderboard",
		},
		{
			description: "An application that contains various object detection models to try from.",
			id: "Gradio-Blocks/Object-Detection-With-DETR-and-YOLOS",
		},
		{
			description: "An application that shows multiple cutting edge techniques for object detection and tracking.",
			id: "kadirnar/torchyolo",
		},
		{
			description: "An object tracking, segmentation and inpainting application.",
			id: "VIPLab/Track-Anything",
		},
		{
			description: "Very fast object tracking application based on object detection.",
			id: "merve/RT-DETR-tracking-coco",
		},
	],
	summary:
		"Object Detection models allow users to identify objects of certain defined classes. Object detection models receive an image as input and output the images with bounding boxes and labels on detected objects.",
	widgetModels: ["facebook/detr-resnet-50"],
	youtubeId: "WdAeKSOpxhw",
};

export default taskData;
