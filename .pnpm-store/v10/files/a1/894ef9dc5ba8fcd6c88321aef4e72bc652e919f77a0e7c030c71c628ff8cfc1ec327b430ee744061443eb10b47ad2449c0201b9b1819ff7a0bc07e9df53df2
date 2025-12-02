import { assert, it, describe } from "vitest";
import { fileDownloadInfo } from "./file-download-info";

describe("fileDownloadInfo", () => {
	it("should fetch LFS file info", async () => {
		const info = await fileDownloadInfo({
			repo: {
				name: "bert-base-uncased",
				type: "model",
			},
			path: "tf_model.h5",
			revision: "dd4bc8b21efa05ec961e3efc4ee5e3832a3679c7",
		});

		assert.strictEqual(info?.size, 536063208);
		assert.strictEqual(info?.etag, '"41a0e56472bad33498744818c8b1ef2c-64"');
		assert(info?.downloadLink);
	});

	it("should fetch raw LFS pointer info", async () => {
		const info = await fileDownloadInfo({
			repo: {
				name: "bert-base-uncased",
				type: "model",
			},
			path: "tf_model.h5",
			revision: "dd4bc8b21efa05ec961e3efc4ee5e3832a3679c7",
			raw: true,
		});

		assert.strictEqual(info?.size, 134);
		assert.strictEqual(info?.etag, '"9eb98c817f04b051b3bcca591bcd4e03cec88018"');
		assert(!info?.downloadLink);
	});

	it("should fetch non-LFS file info", async () => {
		const info = await fileDownloadInfo({
			repo: {
				name: "bert-base-uncased",
				type: "model",
			},
			path: "tokenizer_config.json",
			revision: "1a7dd4986e3dab699c24ca19b2afd0f5e1a80f37",
		});

		assert.strictEqual(info?.size, 28);
		assert.strictEqual(info?.etag, '"a661b1a138dac6dc5590367402d100765010ffd6"');
	});
});
