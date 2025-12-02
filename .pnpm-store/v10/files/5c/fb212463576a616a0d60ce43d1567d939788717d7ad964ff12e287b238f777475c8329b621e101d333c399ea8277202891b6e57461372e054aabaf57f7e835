import { assert, it, describe } from "vitest";
import type { CommitData } from "./list-commits";
import { listCommits } from "./list-commits";

describe("listCommits", () => {
	it("should fetch paginated commits from the repo", async () => {
		const commits: CommitData[] = [];
		for await (const commit of listCommits({
			repo: {
				name: "openai-community/gpt2",
				type: "model",
			},
			revision: "607a30d783dfa663caf39e06633721c8d4cfcd7e",
			batchSize: 5,
		})) {
			commits.push(commit);
		}

		assert.equal(commits.length, 26);
		assert.deepEqual(commits.slice(0, 6), [
			{
				oid: "607a30d783dfa663caf39e06633721c8d4cfcd7e",
				title: "Adds the tokenizer configuration file (#80)",
				message: "\n\n\n- Adds tokenizer_config.json file (db6d57930088fb63e52c010bd9ac77c955ac55e7)\n\n",
				authors: [
					{
						username: "lysandre",
						avatarUrl:
							"https://cdn-avatars.huggingface.co/v1/production/uploads/5e3aec01f55e2b62848a5217/PMKS0NNB4MJQlTSFzh918.jpeg",
					},
				],
				date: new Date("2024-02-19T10:57:45.000Z"),
			},
			{
				oid: "11c5a3d5811f50298f278a704980280950aedb10",
				title: "Adding ONNX file of this model (#60)",
				message: "\n\n\n- Adding ONNX file of this model (9411f419c589519e1a46c94ac7789ea20fd7c322)\n\n",
				authors: [
					{
						username: "fxmarty",
						avatarUrl:
							"https://cdn-avatars.huggingface.co/v1/production/uploads/1651743336129-624c60cba8ec93a7ac188b56.png",
					},
				],
				date: new Date("2023-06-30T02:19:43.000Z"),
			},
			{
				oid: "e7da7f221d5bf496a48136c0cd264e630fe9fcc8",
				title: "Update generation_config.json",
				message: "",
				authors: [
					{
						username: "joaogante",
						avatarUrl: "https://cdn-avatars.huggingface.co/v1/production/uploads/1641203017724-noauth.png",
					},
				],
				date: new Date("2022-12-16T15:44:21.000Z"),
			},
			{
				oid: "f27b190eeac4c2302d24068eabf5e9d6044389ae",
				title: "Add note that this is the smallest version of the model (#18)",
				message:
					"\n\n\n- Add note that this is the smallest version of the model (611838ef095a5bb35bf2027d05e1194b7c9d37ac)\n\n\nCo-authored-by: helen <mathemakitten@users.noreply.huggingface.co>\n",
				authors: [
					{
						username: "sgugger",
						avatarUrl:
							"https://cdn-avatars.huggingface.co/v1/production/uploads/1593126474392-5ef50182b71947201082a4e5.jpeg",
					},
					{
						username: "mathemakitten",
						avatarUrl:
							"https://cdn-avatars.huggingface.co/v1/production/uploads/1658248499901-6079afe2d2cd8c150e6ae05e.jpeg",
					},
				],
				date: new Date("2022-11-23T12:55:26.000Z"),
			},
			{
				oid: "0dd7bcc7a64e4350d8859c9a2813132fbf6ae591",
				title: "Our very first generation_config.json (#17)",
				message:
					"\n\n\n- Our very first generation_config.json (671851b7e9d56ef062890732065d7bd5f4628bd6)\n\n\nCo-authored-by: Joao Gante <joaogante@users.noreply.huggingface.co>\n",
				authors: [
					{
						username: "sgugger",
						avatarUrl:
							"https://cdn-avatars.huggingface.co/v1/production/uploads/1593126474392-5ef50182b71947201082a4e5.jpeg",
					},
					{
						username: "joaogante",
						avatarUrl: "https://cdn-avatars.huggingface.co/v1/production/uploads/1641203017724-noauth.png",
					},
				],
				date: new Date("2022-11-18T18:19:30.000Z"),
			},
			{
				oid: "75e09b43581151bd1d9ef6700faa605df408979f",
				title: "Upload model.safetensors with huggingface_hub (#12)",
				message:
					"\n\n\n- Upload model.safetensors with huggingface_hub (ba2f794b2e4ea09ef932a6628fa0815dfaf09661)\n\n\nCo-authored-by: Nicolas Patry <Narsil@users.noreply.huggingface.co>\n",
				authors: [
					{
						username: "julien-c",
						avatarUrl:
							"https://cdn-avatars.huggingface.co/v1/production/uploads/5dd96eb166059660ed1ee413/NQtzmrDdbG0H8qkZvRyGk.jpeg",
					},
					{
						username: "Narsil",
						avatarUrl:
							"https://cdn-avatars.huggingface.co/v1/production/uploads/1608285816082-5e2967b819407e3277369b95.png",
					},
				],
				date: new Date("2022-10-20T09:34:54.000Z"),
			},
		]);
	});
});
