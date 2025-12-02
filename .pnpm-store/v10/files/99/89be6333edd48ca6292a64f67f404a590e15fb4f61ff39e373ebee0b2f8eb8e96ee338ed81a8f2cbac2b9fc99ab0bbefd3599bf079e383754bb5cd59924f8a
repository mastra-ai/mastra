import { assert, it, describe } from "vitest";

import { TEST_HUB_URL, TEST_ACCESS_TOKEN, TEST_USER } from "../test/consts";
import type { RepoId } from "../types/public";
import type { CommitFile } from "./commit";
import { commit } from "./commit";
import { createRepo } from "./create-repo";
import { deleteRepo } from "./delete-repo";
import { downloadFile } from "./download-file";
import { fileDownloadInfo } from "./file-download-info";
import { insecureRandomString } from "../utils/insecureRandomString";
import { isFrontend } from "../utils/isFrontend";

const lfsContent = "O123456789".repeat(100_000);

describe("commit", () => {
	it("should commit to a repo with blobs", async function () {
		const tokenizerJsonUrl = new URL(
			"https://huggingface.co/spaces/aschen/push-model-from-web/raw/main/mobilenet/model.json"
		);
		const repoName = `${TEST_USER}/TEST-${insecureRandomString()}`;
		const repo: RepoId = {
			name: repoName,
			type: "model",
		};

		await createRepo({
			credentials: {
				accessToken: TEST_ACCESS_TOKEN,
			},
			hubUrl: TEST_HUB_URL,
			repo,
			license: "mit",
		});

		try {
			const readme1 = await downloadFile({ repo, path: "README.md", hubUrl: TEST_HUB_URL });
			assert.strictEqual(readme1?.status, 200);

			const nodeOperation: CommitFile[] = isFrontend
				? []
				: [
						{
							operation: "addOrUpdate",
							path: "tsconfig.json",
							content: (await import("node:url")).pathToFileURL("./tsconfig.json") as URL,
						},
				  ];

			await commit({
				repo,
				title: "Some commit",
				credentials: {
					accessToken: TEST_ACCESS_TOKEN,
				},
				hubUrl: TEST_HUB_URL,
				operations: [
					{
						operation: "addOrUpdate",
						content: new Blob(["This is me"]),
						path: "test.txt",
					},
					{
						operation: "addOrUpdate",
						content: new Blob([lfsContent]),
						path: "test.lfs.txt",
					},
					...nodeOperation,
					{
						operation: "addOrUpdate",
						content: tokenizerJsonUrl,
						path: "lamaral.json",
					},
					{
						operation: "delete",
						path: "README.md",
					},
				],
				// To test web workers in the front-end
				useWebWorkers: { minSize: 5_000 },
			});

			const fileContent = await downloadFile({ repo, path: "test.txt", hubUrl: TEST_HUB_URL });
			assert.strictEqual(fileContent?.status, 200);
			assert.strictEqual(await fileContent?.text(), "This is me");

			const lfsFileContent = await downloadFile({ repo, path: "test.lfs.txt", hubUrl: TEST_HUB_URL });
			assert.strictEqual(lfsFileContent?.status, 200);
			assert.strictEqual(await lfsFileContent?.text(), lfsContent);

			const lfsFileUrl = `${TEST_HUB_URL}/${repoName}/raw/main/test.lfs.txt`;
			const lfsFilePointer = await fetch(lfsFileUrl);
			assert.strictEqual(lfsFilePointer.status, 200);
			assert.strictEqual(
				(await lfsFilePointer.text()).trim(),
				`
version https://git-lfs.github.com/spec/v1
oid sha256:a3bbce7ee1df7233d85b5f4d60faa3755f93f537804f8b540c72b0739239ddf8
size ${lfsContent.length}
				`.trim()
			);

			if (!isFrontend) {
				const fileUrlContent = await downloadFile({ repo, path: "tsconfig.json", hubUrl: TEST_HUB_URL });
				assert.strictEqual(fileUrlContent?.status, 200);
				assert.strictEqual(
					await fileUrlContent?.text(),
					(await import("node:fs")).readFileSync("./tsconfig.json", "utf-8")
				);
			}

			const webResourceContent = await downloadFile({ repo, path: "lamaral.json", hubUrl: TEST_HUB_URL });
			assert.strictEqual(webResourceContent?.status, 200);
			assert.strictEqual(await webResourceContent?.text(), await (await fetch(tokenizerJsonUrl)).text());

			const readme2 = await downloadFile({ repo, path: "README.md", hubUrl: TEST_HUB_URL });
			assert.strictEqual(readme2, null);
		} finally {
			await deleteRepo({
				repo: {
					name: repoName,
					type: "model",
				},
				hubUrl: TEST_HUB_URL,
				credentials: { accessToken: TEST_ACCESS_TOKEN },
			});
		}
	}, 60_000);

	it("should commit a full repo from HF with web urls", async function () {
		const repoName = `${TEST_USER}/TEST-${insecureRandomString()}`;
		const repo: RepoId = {
			name: repoName,
			type: "model",
		};

		await createRepo({
			credentials: {
				accessToken: TEST_ACCESS_TOKEN,
			},
			repo,
			hubUrl: TEST_HUB_URL,
		});

		try {
			const FILES_TO_UPLOAD = [
				`https://huggingface.co/spaces/huggingfacejs/push-model-from-web/resolve/main/mobilenet/model.json`,
				`https://huggingface.co/spaces/huggingfacejs/push-model-from-web/resolve/main/mobilenet/group1-shard1of2`,
				`https://huggingface.co/spaces/huggingfacejs/push-model-from-web/resolve/main/mobilenet/group1-shard2of2`,
				`https://huggingface.co/spaces/huggingfacejs/push-model-from-web/resolve/main/mobilenet/coffee.jpg`,
				`https://huggingface.co/spaces/huggingfacejs/push-model-from-web/resolve/main/mobilenet/README.md`,
			];

			const operations: CommitFile[] = await Promise.all(
				FILES_TO_UPLOAD.map(async (file) => {
					return {
						operation: "addOrUpdate",
						path: file.slice(file.indexOf("main/") + "main/".length),
						// upload remote file
						content: new URL(file),
					};
				})
			);
			await commit({
				repo,
				credentials: {
					accessToken: TEST_ACCESS_TOKEN,
				},
				hubUrl: TEST_HUB_URL,
				title: "upload model",
				operations,
			});

			const LFSSize = (await fileDownloadInfo({ repo, path: "mobilenet/group1-shard1of2", hubUrl: TEST_HUB_URL }))
				?.size;

			assert.strictEqual(LFSSize, 4_194_304);

			const pointerFile = await downloadFile({
				repo,
				path: "mobilenet/group1-shard1of2",
				raw: true,
				hubUrl: TEST_HUB_URL,
			});

			// Make sure SHA is computed properly as well
			assert.strictEqual(
				(await pointerFile?.text())?.trim(),
				`
version https://git-lfs.github.com/spec/v1
oid sha256:3fb621eb9b37478239504ee083042d5b18699e8b8618e569478b03b119a85a69
size 4194304			
			`.trim()
			);
		} finally {
			await deleteRepo({
				repo: {
					name: repoName,
					type: "model",
				},
				hubUrl: TEST_HUB_URL,
				credentials: { accessToken: TEST_ACCESS_TOKEN },
			});
		}
		// https://huggingfacejs-push-model-from-web.hf.space/
	}, 60_000);

	it("should be able to create a PR and then commit to it", async function () {
		const repoName = `${TEST_USER}/TEST-${insecureRandomString()}`;
		const repo: RepoId = {
			name: repoName,
			type: "model",
		};

		await createRepo({
			credentials: {
				accessToken: TEST_ACCESS_TOKEN,
			},
			repo,
			hubUrl: TEST_HUB_URL,
		});

		try {
			const pr = await commit({
				repo,
				credentials: {
					accessToken: TEST_ACCESS_TOKEN,
				},
				hubUrl: TEST_HUB_URL,
				title: "Create PR",
				isPullRequest: true,
				operations: [
					{
						operation: "addOrUpdate",
						content: new Blob(["This is me"]),
						path: "test.txt",
					},
				],
			});

			if (!pr) {
				throw new Error("PR creation failed");
			}

			if (!pr.pullRequestUrl) {
				throw new Error("No pull request url");
			}

			const prNumber = pr.pullRequestUrl.split("/").pop();
			const prRef = `refs/pr/${prNumber}`;

			await commit({
				repo,
				credentials: {
					accessToken: TEST_ACCESS_TOKEN,
				},
				hubUrl: TEST_HUB_URL,
				branch: prRef,
				title: "Some commit",
				operations: [
					{
						operation: "addOrUpdate",
						content: new URL(
							`https://huggingface.co/spaces/huggingfacejs/push-model-from-web/resolve/main/mobilenet/group1-shard1of2`
						),
						path: "mobilenet/group1-shard1of2",
					},
				],
			});

			assert(commit, "PR commit failed");
		} finally {
			await deleteRepo({
				repo: {
					name: repoName,
					type: "model",
				},
				hubUrl: TEST_HUB_URL,
				credentials: { accessToken: TEST_ACCESS_TOKEN },
			});
		}
	}, 60_000);
});
