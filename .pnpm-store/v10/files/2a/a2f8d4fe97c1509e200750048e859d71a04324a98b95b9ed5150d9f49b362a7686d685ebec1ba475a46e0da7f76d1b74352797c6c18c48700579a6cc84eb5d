import { describe, expect, it } from "vitest";
import { eventToGenerator } from "./eventToGenerator";

describe("eventToGenerator", () => {
	it("should handle synchronous events", async () => {
		const it = eventToGenerator<number, number>((yieldCallback, returnCallback) => {
			yieldCallback(1);
			yieldCallback(2);
			returnCallback(3);
		});

		const results = [];
		let res: IteratorResult<number, number>;
		do {
			res = await it.next();
			if (!res.done) {
				results.push(res.value);
			}
		} while (!res.done);

		expect(results).toEqual([1, 2]);
		expect(res.value).toBe(3);
	});

	it("should handle asynchronous events", async () => {
		const it = eventToGenerator<number, number>((yieldCallback, returnCallback) => {
			setTimeout(() => yieldCallback(1), 100);
			setTimeout(() => yieldCallback(2), 200);
			setTimeout(() => returnCallback(3), 300);
		});

		const results = [];
		let res: IteratorResult<number, number>;
		do {
			res = await it.next();
			if (!res.done) {
				results.push(res.value);
			}
		} while (!res.done);

		expect(results).toEqual([1, 2]);
		expect(res.value).toBe(3);
	});
});
