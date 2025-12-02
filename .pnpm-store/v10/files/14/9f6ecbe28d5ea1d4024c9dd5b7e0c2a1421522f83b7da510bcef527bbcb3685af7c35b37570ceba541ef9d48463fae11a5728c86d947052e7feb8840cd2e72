import { assert, it, describe } from "vitest";

import { TEST_HUB_URL, TEST_ACCESS_TOKEN, TEST_USER } from "../test/consts";
import type { RepoId } from "../types/public";
import { insecureRandomString } from "../utils/insecureRandomString";
import { createRepo } from "./create-repo";
import { deleteRepo } from "./delete-repo";
import { downloadFile } from "./download-file";
import { uploadFilesWithProgress } from "./upload-files-with-progress";
import type { CommitOutput, CommitProgressEvent } from "./commit";

describe("uploadFilesWithProgress", () => {
	it("should upload files", async () => {
		const repoName = `${TEST_USER}/TEST-${insecureRandomString()}`;
		const repo = { type: "model", name: repoName } satisfies RepoId;
		const credentials = {
			accessToken: TEST_ACCESS_TOKEN,
		};
		const lfsContent = "O123456789".repeat(100_000);

		try {
			const result = await createRepo({
				credentials,
				repo,
				hubUrl: TEST_HUB_URL,
			});

			assert.deepStrictEqual(result, {
				repoUrl: `${TEST_HUB_URL}/${repoName}`,
			});

			const it = uploadFilesWithProgress({
				credentials,
				repo,
				files: [
					{ content: new Blob(["file1"]), path: "file1" },
					new URL("https://huggingface.co/gpt2/raw/main/config.json"),
					// Large file
					{
						content: new Blob([lfsContent]),
						path: "test.lfs.txt",
					},
				],
				useWebWorkers: {
					minSize: 1_000,
				},
				hubUrl: TEST_HUB_URL,
			});

			let res: IteratorResult<CommitProgressEvent, CommitOutput>;
			let progressEvents: CommitProgressEvent[] = [];

			do {
				res = await it.next();
				if (!res.done) {
					progressEvents.push(res.value);
				}
			} while (!res.done);

			// const intermediateHashingEvents = progressEvents.filter(
			// 	(e) => e.event === "fileProgress" && e.type === "hashing" && e.progress !== 0 && e.progress !== 1
			// );
			// if (isFrontend) {
			// 	assert(intermediateHashingEvents.length > 0);
			// }
			// const intermediateUploadEvents = progressEvents.filter(
			// 	(e) => e.event === "fileProgress" && e.type === "uploading" && e.progress !== 0 && e.progress !== 1
			// );
			// if (isFrontend) {
			// 	assert(intermediateUploadEvents.length > 0, "There should be at least one intermediate upload event");
			// }
			progressEvents = progressEvents.filter((e) => e.event !== "fileProgress" || e.progress === 0 || e.progress === 1);

			assert.deepStrictEqual(progressEvents, [
				{
					event: "phase",
					phase: "preuploading",
				},
				{
					event: "phase",
					phase: "uploadingLargeFiles",
				},
				{
					event: "fileProgress",
					path: "test.lfs.txt",
					progress: 0,
					state: "hashing",
				},
				{
					event: "fileProgress",
					path: "test.lfs.txt",
					progress: 1,
					state: "hashing",
				},
				{
					event: "fileProgress",
					path: "test.lfs.txt",
					progress: 0,
					state: "uploading",
				},
				{
					event: "fileProgress",
					path: "test.lfs.txt",
					progress: 1,
					state: "uploading",
				},
				{
					event: "phase",
					phase: "committing",
				},
			]);

			let content = await downloadFile({
				repo,
				path: "file1",
				hubUrl: TEST_HUB_URL,
			});

			assert.strictEqual(await content?.text(), "file1");

			content = await downloadFile({
				repo,
				path: "config.json",
				hubUrl: TEST_HUB_URL,
			});

			assert.strictEqual(
				(await content?.text())?.trim(),
				`
{
  "activation_function": "gelu_new",
  "architectures": [
    "GPT2LMHeadModel"
  ],
  "attn_pdrop": 0.1,
  "bos_token_id": 50256,
  "embd_pdrop": 0.1,
  "eos_token_id": 50256,
  "initializer_range": 0.02,
  "layer_norm_epsilon": 1e-05,
  "model_type": "gpt2",
  "n_ctx": 1024,
  "n_embd": 768,
  "n_head": 12,
  "n_layer": 12,
  "n_positions": 1024,
  "resid_pdrop": 0.1,
  "summary_activation": null,
  "summary_first_dropout": 0.1,
  "summary_proj_to_labels": true,
  "summary_type": "cls_index",
  "summary_use_proj": true,
  "task_specific_params": {
    "text-generation": {
      "do_sample": true,
      "max_length": 50
    }
  },
  "vocab_size": 50257
}
      `.trim()
			);
		} finally {
			await deleteRepo({
				repo,
				credentials,
				hubUrl: TEST_HUB_URL,
			});
		}
	}, 60_000);
});
