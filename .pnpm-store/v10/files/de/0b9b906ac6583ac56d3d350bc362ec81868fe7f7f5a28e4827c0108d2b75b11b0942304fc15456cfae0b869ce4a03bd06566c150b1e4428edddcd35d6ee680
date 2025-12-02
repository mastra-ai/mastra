import { describe, expect, it } from "vitest";
import type { SpaceEntry } from "./list-spaces";
import { listSpaces } from "./list-spaces";

describe("listSpaces", () => {
	it("should list spaces for Microsoft", async () => {
		const results: SpaceEntry[] = [];

		for await (const entry of listSpaces({
			search: { owner: "microsoft" },
			additionalFields: ["subdomain"],
		})) {
			if (entry.name !== "microsoft/visual_chatgpt") {
				continue;
			}
			if (typeof entry.likes === "number") {
				entry.likes = 0;
			}
			if (entry.updatedAt instanceof Date && !isNaN(entry.updatedAt.getTime())) {
				entry.updatedAt = new Date(0);
			}

			results.push(entry);
		}

		results.sort((a, b) => a.id.localeCompare(b.id));

		expect(results).deep.equal([
			{
				id: "6409a392bbc73d022c58c980",
				name: "microsoft/visual_chatgpt",
				private: false,
				likes: 0,
				sdk: "gradio",
				subdomain: "microsoft-visual-chatgpt",
				updatedAt: new Date(0),
			},
		]);
	});
});
