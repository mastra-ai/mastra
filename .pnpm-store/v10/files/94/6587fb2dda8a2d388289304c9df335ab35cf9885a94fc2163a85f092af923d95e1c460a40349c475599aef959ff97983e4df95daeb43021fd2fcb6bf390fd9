import { open, stat } from "node:fs/promises";
import { TextDecoder } from "node:util";
import { describe, expect, it } from "vitest";
import { FileBlob } from "./FileBlob";

describe("FileBlob", () => {
	it("should create a FileBlob with a slice on the entire file", async () => {
		const file = await open("package.json", "r");
		const { size } = await stat("package.json");

		const fileBlob = await FileBlob.create("package.json");

		expect(fileBlob).toMatchObject({
			path: "package.json",
			start: 0,
			end: size,
		});
		expect(fileBlob.size).toBe(size);
		expect(fileBlob.type).toBe("");
		const text = await fileBlob.text();
		const expectedText = (await file.read(Buffer.alloc(size), 0, size)).buffer.toString("utf8");
		expect(text).toBe(expectedText);
		const result = await fileBlob.stream().getReader().read();
		expect(new TextDecoder().decode(result.value)).toBe(expectedText);
	});

	it("should create a slice on the file", async () => {
		const file = await open("package.json", "r");
		const fileBlob = await FileBlob.create("package.json");

		const slice = fileBlob.slice(10, 20);

		expect(slice).toMatchObject({
			path: "package.json",
			start: 10,
			end: 20,
		});
		expect(slice.size).toBe(10);
		const sliceText = await slice.text();
		const expectedText = (await file.read(Buffer.alloc(10), 0, 10, 10)).buffer.toString("utf8");
		expect(sliceText).toBe(expectedText);
		const result = await slice.stream().getReader().read();
		expect(new TextDecoder().decode(result.value)).toBe(expectedText);
	});
});
