import { assert, it, describe, expect } from "vitest";

import { TEST_HUB_URL, TEST_ACCESS_TOKEN, TEST_USER } from "../test/consts";
import { insecureRandomString } from "../utils/insecureRandomString";
import { createRepo } from "./create-repo";
import { deleteRepo } from "./delete-repo";
import { downloadFile } from "./download-file";

describe("createRepo", () => {
	it("should create a repo", async () => {
		const repoName = `${TEST_USER}/TEST-${insecureRandomString()}`;

		const result = await createRepo({
			credentials: {
				accessToken: TEST_ACCESS_TOKEN,
			},
			repo: {
				name: repoName,
				type: "model",
			},
			hubUrl: TEST_HUB_URL,
			files: [{ path: ".gitattributes", content: new Blob(["*.html filter=lfs diff=lfs merge=lfs -text"]) }],
		});

		assert.deepStrictEqual(result, {
			repoUrl: `${TEST_HUB_URL}/${repoName}`,
		});

		const content = await downloadFile({
			repo: {
				name: repoName,
				type: "model",
			},
			path: ".gitattributes",
			hubUrl: TEST_HUB_URL,
		});

		assert(content);
		assert.strictEqual(await content.text(), "*.html filter=lfs diff=lfs merge=lfs -text");

		await deleteRepo({
			repo: {
				name: repoName,
				type: "model",
			},
			credentials: { accessToken: TEST_ACCESS_TOKEN },
			hubUrl: TEST_HUB_URL,
		});
	});

	it("should throw a client error when trying to create a repo without a fully-qualified name", async () => {
		const tryCreate = createRepo({
			repo: { name: "canonical", type: "model" },
			credentials: { accessToken: TEST_ACCESS_TOKEN },
			hubUrl: TEST_HUB_URL,
		});

		await expect(tryCreate).rejects.toBeInstanceOf(TypeError);
	});

	it("should create a model with a string as name", async () => {
		const repoName = `${TEST_USER}/TEST-${insecureRandomString()}`;

		const result = await createRepo({
			credentials: {
				accessToken: TEST_ACCESS_TOKEN,
			},
			hubUrl: TEST_HUB_URL,
			repo: repoName,
			files: [{ path: ".gitattributes", content: new Blob(["*.html filter=lfs diff=lfs merge=lfs -text"]) }],
		});

		assert.deepStrictEqual(result, {
			repoUrl: `${TEST_HUB_URL}/${repoName}`,
		});

		await deleteRepo({
			repo: {
				name: repoName,
				type: "model",
			},
			hubUrl: TEST_HUB_URL,
			credentials: { accessToken: TEST_ACCESS_TOKEN },
		});
	});

	it("should create a dataset with a string as name", async () => {
		const repoName = `datasets/${TEST_USER}/TEST-${insecureRandomString()}`;

		const result = await createRepo({
			credentials: {
				accessToken: TEST_ACCESS_TOKEN,
			},
			hubUrl: TEST_HUB_URL,
			repo: repoName,
			files: [{ path: ".gitattributes", content: new Blob(["*.html filter=lfs diff=lfs merge=lfs -text"]) }],
		});

		assert.deepStrictEqual(result, {
			repoUrl: `${TEST_HUB_URL}/${repoName}`,
		});

		await deleteRepo({
			repo: repoName,
			hubUrl: TEST_HUB_URL,
			credentials: { accessToken: TEST_ACCESS_TOKEN },
		});
	});
}, 10_000);
