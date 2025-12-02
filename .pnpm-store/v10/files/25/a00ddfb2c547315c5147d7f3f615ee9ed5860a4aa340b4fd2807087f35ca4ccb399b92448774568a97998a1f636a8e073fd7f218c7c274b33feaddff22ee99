import { describe, expect, it } from "vitest";
import { promisesQueue } from "./promisesQueue";

describe("promisesQueue", () => {
	it("should handle multiple errors without triggering an uncaughtException", async () => {
		const factories = [
			() => Promise.reject(new Error("error 1")),
			() => Promise.reject(new Error("error 2")),
			() => Promise.reject(new Error("error 3")),
		];

		try {
			await promisesQueue(factories, 10);
		} catch (err) {
			if (!(err instanceof Error)) {
				throw err;
			}
		}

		try {
			await promisesQueue(factories, 1);
		} catch (err) {
			if (!(err instanceof Error)) {
				throw err;
			}
			expect(err.message).toBe("error 1");
		}
	});

	it("should return ordered results", async () => {
		const factories = [
			() => Promise.resolve(1),
			() => Promise.resolve(2),
			() => Promise.resolve(3),
			() => Promise.resolve(4),
			() => Promise.resolve(5),
			() => Promise.resolve(6),
			() => Promise.resolve(7),
			() => Promise.resolve(8),
			() => Promise.resolve(9),
			() => Promise.resolve(10),
		];

		const results = await promisesQueue(factories, 3);

		expect(results).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
	});
});
