/**
 * Execute queue of promises in a streaming fashion.
 *
 * Optimized for streaming:
 * - Expects an iterable as input
 * - Does not return a list of all results
 *
 * Inspired by github.com/rxaviers/async-pool
 */
export async function promisesQueueStreaming<T>(
	factories: AsyncIterable<() => Promise<T>> | Iterable<() => Promise<T>>,
	concurrency: number
): Promise<void> {
	const executing: Promise<void>[] = [];
	for await (const factory of factories) {
		const e = factory().then(() => {
			executing.splice(executing.indexOf(e), 1);
		});
		executing.push(e);
		if (executing.length >= concurrency) {
			await Promise.race(executing);
		}
	}
	await Promise.all(executing);
}
