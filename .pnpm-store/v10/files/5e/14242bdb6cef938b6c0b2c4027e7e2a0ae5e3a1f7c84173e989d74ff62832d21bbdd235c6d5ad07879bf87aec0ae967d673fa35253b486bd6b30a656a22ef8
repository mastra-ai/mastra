import { assert, it, describe } from "vitest";

import { TEST_ACCESS_TOKEN, TEST_HUB_URL, TEST_USER } from "../test/consts";
import type { RepoId } from "../types/public";
import { insecureRandomString } from "../utils/insecureRandomString";
import { createRepo } from "./create-repo";
import { deleteRepo } from "./delete-repo";
import { downloadFile } from "./download-file";
import { uploadFiles } from "./upload-files";

describe("uploadFiles", () => {
	it("should upload files", async () => {
		const repoName = `${TEST_USER}/TEST-${insecureRandomString()}`;
		const repo = { type: "model", name: repoName } satisfies RepoId;
		const credentials = {
			accessToken: TEST_ACCESS_TOKEN,
		};

		try {
			const result = await createRepo({
				credentials,
				repo,
				hubUrl: TEST_HUB_URL,
			});

			assert.deepStrictEqual(result, {
				repoUrl: `${TEST_HUB_URL}/${repoName}`,
			});

			await uploadFiles({
				credentials,
				repo,
				files: [
					{ content: new Blob(["file1"]), path: "file1" },
					new URL("https://huggingface.co/gpt2/raw/main/config.json"),
				],
				hubUrl: TEST_HUB_URL,
			});

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
	});
}, 10_000);
