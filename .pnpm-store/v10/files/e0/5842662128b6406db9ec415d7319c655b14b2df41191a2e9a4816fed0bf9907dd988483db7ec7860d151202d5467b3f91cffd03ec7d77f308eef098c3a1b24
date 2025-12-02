import { assert, it, describe } from "vitest";
import { countCommits } from "./count-commits";

describe("countCommits", () => {
	it("should fetch paginated commits from the repo", async () => {
		const count = await countCommits({
			repo: {
				name: "openai-community/gpt2",
				type: "model",
			},
			revision: "607a30d783dfa663caf39e06633721c8d4cfcd7e",
		});

		assert.equal(count, 26);
	});
});
