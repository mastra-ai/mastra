export async function* eventToGenerator<YieldType, ReturnType>(
	cb: (
		yieldCallback: (y: YieldType) => void,
		returnCallback: (r: ReturnType) => void,
		rejectCallack: (reason: unknown) => void
	) => unknown
): AsyncGenerator<YieldType, ReturnType> {
	const promises: Array<{
		p: Promise<{ done: true; value: ReturnType } | { done: false; value: YieldType }>;
		resolve: (value: { done: true; value: ReturnType } | { done: false; value: YieldType }) => void;
		reject: (reason?: unknown) => void;
	}> = [];

	function addPromise() {
		let resolve: (value: { done: true; value: ReturnType } | { done: false; value: YieldType }) => void;
		let reject: (reason?: unknown) => void;
		const p = new Promise<{ done: true; value: ReturnType } | { done: false; value: YieldType }>((res, rej) => {
			resolve = res;
			reject = rej;
		});
		// @ts-expect-error TS doesn't know that promise callback is executed immediately
		promises.push({ p, resolve, reject });
	}

	addPromise();

	const callbackRes = Promise.resolve()
		.then(() =>
			cb(
				(y) => {
					addPromise();
					promises.at(-2)?.resolve({ done: false, value: y });
				},
				(r) => {
					addPromise();
					promises.at(-2)?.resolve({ done: true, value: r });
				},
				(err) => promises.shift()?.reject(err)
			)
		)
		.catch((err) => promises.shift()?.reject(err));

	while (1) {
		const p = promises[0];
		if (!p) {
			throw new Error("Logic error in eventGenerator, promises should never be empty");
		}
		const result = await p.p;
		promises.shift();
		if (result.done) {
			await callbackRes; // Clean up, may be removed in the future
			// // Cleanup promises - shouldn't be needed due to above await
			// for (const promise of promises) {
			// 	promise.resolve(result);
			// 	await promise.p;
			// }
			return result.value;
		}
		yield result.value;
	}

	// So TS doesn't complain
	throw new Error("Unreachable");
}
