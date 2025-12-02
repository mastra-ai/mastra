import * as readline from 'node:readline/promises';

export const lineIterator = async function * (subprocess, {state}, streamName, index) {
	// Prevent buffering when iterating.
	// This would defeat one of the main goals of iterating: low memory consumption.
	if (state.isIterating[streamName] === false) {
		throw new Error(`The subprocess must be iterated right away, for example:
	for await (const line of spawn(...)) { ... }`);
	}

	state.isIterating[streamName] = true;

	try {
		const {[streamName]: stream} = await subprocess.nodeChildProcess;
		if (!stream) {
			state.nonIterable[index] = true;
			const message = state.nonIterable.every(Boolean)
				? 'either the option `stdout` or `stderr`'
				: `the option \`${streamName}\``;
			throw new TypeError(
				`The subprocess cannot be iterated unless ${message} is 'pipe'.`,
			);
		}

		handleErrors(subprocess);
		yield * readline.createInterface({input: stream});
	} finally {
		await subprocess;
	}
};

// When the `subprocess` promise is rejected, we await it in the `finally`
// block. However, this might not happen right away, so an `unhandledRejection`
// error is emitted first, crashing the process. This prevents it.
// This is safe since we are guaranteed to propagate the `subprocess` error
// with the `finally` block.
// See https://github.com/sindresorhus/nano-spawn/issues/104
const handleErrors = async subprocess => {
	try {
		await subprocess;
	} catch {}
};

// Merge two async iterators into one
export const combineAsyncIterators = async function * ({state}, ...iterators) {
	try {
		let promises = [];
		while (iterators.length > 0) {
			promises = iterators.map((iterator, index) => promises[index] ?? getNext(iterator, index, state));
			// eslint-disable-next-line no-await-in-loop
			const [{value, done}, index] = await Promise.race(promises
				.map((promise, index) => Promise.all([promise, index])));

			const [iterator] = iterators.splice(index, 1);
			promises.splice(index, 1);

			if (!done) {
				iterators.push(iterator);
				yield value;
			}
		}
	} finally {
		await Promise.all(iterators.map(iterator => iterator.return()));
	}
};

const getNext = async (iterator, index, {nonIterable}) => {
	try {
		return await iterator.next();
	} catch (error) {
		return shouldIgnoreError(nonIterable, index)
			? iterator.return()
			: iterator.throw(error);
	}
};

const shouldIgnoreError = (nonIterable, index) => nonIterable.every(Boolean)
	? index !== nonIterable.length - 1
	: nonIterable[index];
