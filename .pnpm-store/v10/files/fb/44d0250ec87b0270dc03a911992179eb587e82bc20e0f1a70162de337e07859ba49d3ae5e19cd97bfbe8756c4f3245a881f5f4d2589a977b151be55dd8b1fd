import { assert, it, describe } from "vitest";
import { parseSafetensorsMetadata, parseSafetensorsShardFilename } from "./parse-safetensors-metadata";
import { sum } from "../utils/sum";

describe("parseSafetensorsMetadata", () => {
	it("fetch info for single-file (with the default conventional filename)", async () => {
		const parse = await parseSafetensorsMetadata({
			repo: "bert-base-uncased",
			computeParametersCount: true,
			revision: "86b5e0934494bd15c9632b12f734a8a67f723594",
		});

		assert(!parse.sharded);
		assert.deepStrictEqual(parse.header.__metadata__, { format: "pt" });

		// Example of one tensor (the header contains many tensors)

		assert.deepStrictEqual(parse.header["bert.embeddings.LayerNorm.beta"], {
			dtype: "F32",
			shape: [768],
			data_offsets: [0, 3072],
		});

		assert.deepStrictEqual(parse.parameterCount, { F32: 110_106_428 });
		assert.deepStrictEqual(sum(Object.values(parse.parameterCount)), 110_106_428);
		// total params = 110m
	});

	it("fetch info for sharded (with the default conventional filename)", async () => {
		const parse = await parseSafetensorsMetadata({
			repo: "bigscience/bloom",
			computeParametersCount: true,
			revision: "053d9cd9fbe814e091294f67fcfedb3397b954bb",
		});

		assert(parse.sharded);

		assert.strictEqual(Object.keys(parse.headers).length, 72);
		// This model has 72 shards!

		// Example of one tensor inside one file

		assert.deepStrictEqual(parse.headers["model_00012-of-00072.safetensors"]["h.10.input_layernorm.weight"], {
			dtype: "BF16",
			shape: [14336],
			data_offsets: [3288649728, 3288678400],
		});

		assert.deepStrictEqual(parse.parameterCount, { BF16: 176_247_271_424 });
		assert.deepStrictEqual(sum(Object.values(parse.parameterCount)), 176_247_271_424);
		// total params = 176B
	}, 30_000);

	it("fetch info for single-file with multiple dtypes", async () => {
		const parse = await parseSafetensorsMetadata({
			repo: "roberta-base",
			computeParametersCount: true,
			revision: "e2da8e2f811d1448a5b465c236feacd80ffbac7b",
		});

		assert(!parse.sharded);

		assert.deepStrictEqual(parse.parameterCount, { F32: 124_697_433, I64: 514 });
		assert.deepStrictEqual(sum(Object.values(parse.parameterCount)), 124_697_947);
		// total params = 124m
	});

	it("fetch info for single-file with file path", async () => {
		const parse = await parseSafetensorsMetadata({
			repo: "CompVis/stable-diffusion-v1-4",
			computeParametersCount: true,
			path: "unet/diffusion_pytorch_model.safetensors",
			revision: "133a221b8aa7292a167afc5127cb63fb5005638b",
		});

		assert(!parse.sharded);
		assert.deepStrictEqual(parse.header.__metadata__, { format: "pt" });

		// Example of one tensor (the header contains many tensors)

		assert.deepStrictEqual(parse.header["up_blocks.3.resnets.0.norm2.bias"], {
			dtype: "F32",
			shape: [320],
			data_offsets: [3_409_382_416, 3_409_383_696],
		});

		assert.deepStrictEqual(parse.parameterCount, { F32: 859_520_964 });
		assert.deepStrictEqual(sum(Object.values(parse.parameterCount)), 859_520_964);
	});

	it("fetch info for sharded (with the default conventional filename) with file path", async () => {
		const parse = await parseSafetensorsMetadata({
			repo: "Alignment-Lab-AI/ALAI-gemma-7b",
			computeParametersCount: true,
			path: "7b/1/model.safetensors.index.json",
			revision: "37e307261fe97bbf8b2463d61dbdd1a10daa264c",
		});

		assert(parse.sharded);

		assert.strictEqual(Object.keys(parse.headers).length, 4);

		assert.deepStrictEqual(parse.headers["model-00004-of-00004.safetensors"]["model.layers.24.mlp.up_proj.weight"], {
			dtype: "BF16",
			shape: [24576, 3072],
			data_offsets: [301996032, 452990976],
		});

		assert.deepStrictEqual(parse.parameterCount, { BF16: 8_537_680_896 });
		assert.deepStrictEqual(sum(Object.values(parse.parameterCount)), 8_537_680_896);
	});

	it("should detect sharded safetensors filename", async () => {
		const safetensorsFilename = "model_00005-of-00072.safetensors"; // https://huggingface.co/bigscience/bloom/blob/4d8e28c67403974b0f17a4ac5992e4ba0b0dbb6f/model_00005-of-00072.safetensors
		const safetensorsShardFileInfo = parseSafetensorsShardFilename(safetensorsFilename);

		assert.strictEqual(safetensorsShardFileInfo?.prefix, "model_");
		assert.strictEqual(safetensorsShardFileInfo?.basePrefix, "model");
		assert.strictEqual(safetensorsShardFileInfo?.shard, "00005");
		assert.strictEqual(safetensorsShardFileInfo?.total, "00072");
	});
});
