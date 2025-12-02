/**
 * Execute queue of promises.
 *
 * Inspired by github.com/rxaviers/async-pool
 */
export async function promisesQueue<T>(factories: (() => Promise<T>)[], concurrency: number): Promise<T[]> {
	const results: T[] = [];
	const executing: Set<Promise<void>> = new Set();
	let index = 0;
	for (const factory of factories) {
		const closureIndex = index++;
		const e = factory().then((r) => {
			results[closureIndex] = r;
			executing.delete(e);
		});
		executing.add(e);
		if (executing.size >= concurrency) {
			await Promise.race(executing);
		}
	}
	await Promise.all(executing);
	return results;
}
