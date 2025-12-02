import { assert, it, describe } from "vitest";
import type { ListFileEntry } from "./list-files";
import { listFiles } from "./list-files";

describe("listFiles", () => {
	it("should fetch the list of files from the repo", async () => {
		const cursor = listFiles({
			repo: {
				name: "bert-base-uncased",
				type: "model",
			},
			revision: "dd4bc8b21efa05ec961e3efc4ee5e3832a3679c7",
		});

		const files: ListFileEntry[] = [];

		for await (const entry of cursor) {
			files.push(entry);
		}

		assert.deepStrictEqual(files, [
			{
				oid: "dc08351d4dc0732d9c8af04070ced089b201ce2f",
				path: ".gitattributes",
				size: 345,
				type: "file",
			},
			{
				oid: "fca794a5f07ff8f963fe8b61e3694b0fb7f955df",
				path: "config.json",
				size: 313,
				type: "file",
			},
			{
				lfs: {
					oid: "097417381d6c7230bd9e3557456d726de6e83245ec8b24f529f60198a67b203a",
					size: 440473133,
					pointerSize: 134,
				},
				oid: "ba5d19791be1dd7992e33bd61f20207b0f7f50a5",
				path: "pytorch_model.bin",
				size: 440473133,
				type: "file",
			},
			{
				lfs: {
					oid: "a7a17d6d844b5de815ccab5f42cad6d24496db3850a2a43d8258221018ce87d2",
					size: 536063208,
					pointerSize: 134,
				},
				oid: "9eb98c817f04b051b3bcca591bcd4e03cec88018",
				path: "tf_model.h5",
				size: 536063208,
				type: "file",
			},
			{
				oid: "fb140275c155a9c7c5a3b3e0e77a9e839594a938",
				path: "vocab.txt",
				size: 231508,
				type: "file",
			},
		]);
	});

	it("should fetch the list of files from the repo, including last commit", async () => {
		const cursor = listFiles({
			repo: {
				name: "bert-base-uncased",
				type: "model",
			},
			revision: "dd4bc8b21efa05ec961e3efc4ee5e3832a3679c7",
			expand: true,
		});

		const files: ListFileEntry[] = [];

		for await (const entry of cursor) {
			delete entry.security; // flaky
			files.push(entry);
		}

		assert.deepStrictEqual(files, [
			{
				lastCommit: {
					date: "2018-11-14T23:35:08.000Z",
					id: "504939aa53e8ce310dba3dd2296dbe266c575de4",
					title: "initial commit",
				},
				oid: "dc08351d4dc0732d9c8af04070ced089b201ce2f",
				path: ".gitattributes",
				size: 345,
				type: "file",
			},
			{
				lastCommit: {
					date: "2019-06-18T09:06:51.000Z",
					id: "bb3c1c3256d2598217df9889a14a2e811587891d",
					title: "Update config.json",
				},
				oid: "fca794a5f07ff8f963fe8b61e3694b0fb7f955df",
				path: "config.json",
				size: 313,
				type: "file",
			},
			{
				lastCommit: {
					date: "2019-06-18T09:06:34.000Z",
					id: "3d2477d72b675a999d1b13ca822aaaf4908634ad",
					title: "Update pytorch_model.bin",
				},
				lfs: {
					oid: "097417381d6c7230bd9e3557456d726de6e83245ec8b24f529f60198a67b203a",
					size: 440473133,
					pointerSize: 134,
				},
				oid: "ba5d19791be1dd7992e33bd61f20207b0f7f50a5",
				path: "pytorch_model.bin",
				size: 440473133,
				type: "file",
			},
			{
				lastCommit: {
					date: "2019-09-23T19:48:44.000Z",
					id: "dd4bc8b21efa05ec961e3efc4ee5e3832a3679c7",
					title: "Update tf_model.h5",
				},
				lfs: {
					oid: "a7a17d6d844b5de815ccab5f42cad6d24496db3850a2a43d8258221018ce87d2",
					size: 536063208,
					pointerSize: 134,
				},
				oid: "9eb98c817f04b051b3bcca591bcd4e03cec88018",
				path: "tf_model.h5",
				size: 536063208,
				type: "file",
			},
			{
				lastCommit: {
					date: "2018-11-14T23:35:08.000Z",
					id: "2f07d813ca87c8c709147704c87210359ccf2309",
					title: "Update vocab.txt",
				},
				oid: "fb140275c155a9c7c5a3b3e0e77a9e839594a938",
				path: "vocab.txt",
				size: 231508,
				type: "file",
			},
		]);
	});

	it("should fetch the list of files from the repo, including subfolders", async () => {
		const cursor = listFiles({
			repo: {
				name: "xsum",
				type: "dataset",
			},
			revision: "0f3ea2f2b55fcb11e71fb1e3aec6822e44ddcb0f",
			recursive: true,
		});

		const files: ListFileEntry[] = [];

		for await (const entry of cursor) {
			files.push(entry);
		}

		assert(files.some((file) => file.path === "data/XSUM-EMNLP18-Summary-Data-Original.tar.gz"));
	});
});
