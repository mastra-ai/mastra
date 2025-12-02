import { describe, it, expect } from "vitest";
import { sha256 } from "./sha256";

const smallContent = "hello world";
const smallContentSHA256 = "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9";
const bigContent = "O123456789".repeat(100_000);
const bigContentSHA256 = "a3bbce7ee1df7233d85b5f4d60faa3755f93f537804f8b540c72b0739239ddf8";
const biggerContent = "0123456789".repeat(1_000_000);
const biggerContentSHA256 = "d52fcc26b48dbd4d79b125eb0a29b803ade07613c67ac7c6f2751aefef008486";

describe("sha256", () => {
	async function calcSHA256(content: string, useWebWorker: boolean) {
		const iterator = sha256(new Blob([content]), { useWebWorker });
		let res: IteratorResult<number, string>;
		do {
			res = await iterator.next();
		} while (!res.done);
		return res.value;
	}

	it("Calculate hash of a small file", async () => {
		const sha = await calcSHA256(smallContent, false);
		expect(sha).toBe(smallContentSHA256);
	});

	it("Calculate hash of a big file", async () => {
		const sha = await calcSHA256(bigContent, false);
		expect(sha).toBe(bigContentSHA256);
	});

	it("Calculate hash of a bigger file", async () => {
		const sha = await calcSHA256(biggerContent, false);
		expect(sha).toBe(biggerContentSHA256);
	});

	it("Calculate hash of a small file (+ web worker)", async () => {
		const sha = await calcSHA256(smallContent, true);
		expect(sha).toBe(smallContentSHA256);
	});

	it("Calculate hash of a big file (+ web worker)", async () => {
		const sha = await calcSHA256(bigContent, true);
		expect(sha).toBe(bigContentSHA256);
	});

	it("Calculate hash of a bigger file (+ web worker)", async () => {
		const sha = await calcSHA256(biggerContent, true);
		expect(sha).toBe(biggerContentSHA256);
	});
});
