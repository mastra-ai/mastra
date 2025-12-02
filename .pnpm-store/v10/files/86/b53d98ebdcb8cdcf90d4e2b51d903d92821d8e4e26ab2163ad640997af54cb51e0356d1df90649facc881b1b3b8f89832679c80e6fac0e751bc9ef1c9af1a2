//#region src/helpers/promises.ts
/**
* Some environments don't allow access to the global queueMicrotask(). While we
* had assumed this was only true for those powered by earlier versions of Node
* (<14) that we don't officially support, Vercel's Edge Functions also obscure
* the function in dev, even though the platform it's based on (Cloudflare
* Workers) appropriately exposes it. Even worse, production Vercel Edge
* Functions can see the function, but it immediately blows up the function when
* used.
*
* Therefore, we can fall back to a reasonable alternative of
* `Promise.resolve().then(fn)` instead. This _may_ be slightly slower in modern
* environments, but at least we can still work in these environments.
*/
const shimQueueMicrotask = (callback) => {
	Promise.resolve().then(callback);
};
/**
* Returns a Promise that resolves after the current event loop's microtasks
* have finished, but before the next event loop tick.
*/
const resolveAfterPending = (count = 100) => {
	/**
	* This uses a brute force implementation that will continue to enqueue
	* microtasks 10 times before resolving. This is to ensure that the microtask
	* queue is drained, even if the microtask queue is being manipulated by other
	* code.
	*
	* While this still doesn't guarantee that the microtask queue is drained,
	* it's our best bet for giving other non-controlled promises a chance to
	* resolve before we continue without resorting to falling in to the next
	* tick.
	*/
	return new Promise((resolve) => {
		let i = 0;
		const iterate = () => {
			shimQueueMicrotask(() => {
				if (i++ > count) return resolve();
				iterate();
			});
		};
		iterate();
	});
};
/**
* Creates and returns Promise that can be resolved or rejected with the
* returned `resolve` and `reject` functions.
*
* Resolving or rejecting the function will return a new set of Promise control
* functions. These can be ignored if the original Promise is all that's needed.
*/
const createDeferredPromise = () => {
	let resolve;
	let reject;
	return {
		promise: new Promise((_resolve, _reject) => {
			resolve = (value) => {
				_resolve(value);
				return createDeferredPromise();
			};
			reject = (reason) => {
				_reject(reason);
				return createDeferredPromise();
			};
		}),
		resolve,
		reject
	};
};
/**
* Creates and returns a deferred Promise that can be resolved or rejected with
* the returned `resolve` and `reject` functions.
*
* For each Promise resolved or rejected this way, this will also keep a stack
* of all unhandled Promises, resolved or rejected.
*
* Once a Promise is read, it is removed from the stack.
*/
const createDeferredPromiseWithStack = () => {
	const settledPromises = [];
	let rotateQueue = () => {};
	const results = (async function* () {
		while (true) {
			const next = settledPromises.shift();
			if (next) yield next;
			else await new Promise((resolve) => {
				rotateQueue = resolve;
			});
		}
	})();
	const shimDeferredPromise = (deferred) => {
		const originalResolve = deferred.resolve;
		const originalReject = deferred.reject;
		deferred.resolve = (value) => {
			settledPromises.push(deferred.promise);
			rotateQueue();
			return shimDeferredPromise(originalResolve(value));
		};
		deferred.reject = (reason) => {
			settledPromises.push(deferred.promise);
			rotateQueue();
			return shimDeferredPromise(originalReject(reason));
		};
		return deferred;
	};
	return {
		deferred: shimDeferredPromise(createDeferredPromise()),
		results
	};
};
/**
* Creates a Promise that will resolve after the given duration, along with
* methods to start, clear, and reset the timeout.
*/
const createTimeoutPromise = (duration) => {
	const { promise, resolve } = createDeferredPromise();
	let timeout;
	let ret;
	const start = () => {
		if (timeout) return ret;
		timeout = setTimeout(() => {
			resolve();
		}, duration);
		return ret;
	};
	const clear = () => {
		clearTimeout(timeout);
		timeout = void 0;
	};
	const reset = () => {
		clear();
		return start();
	};
	ret = Object.assign(promise, {
		start,
		clear,
		reset
	});
	return ret;
};
/**
* Take any function and safely promisify such that both synchronous and
* asynchronous errors are caught and returned as a rejected Promise.
*
* The passed `fn` can be undefined to support functions that may conditionally
* be defined.
*/
const runAsPromise = (fn) => {
	return Promise.resolve().then(fn);
};
/**
* Returns a Promise that resolve after the current event loop tick.
*/
const resolveNextTick = () => {
	return new Promise((resolve) => setTimeout(resolve));
};
const retryWithBackoff = async (fn, opts) => {
	const maxAttempts = opts?.maxAttempts || 5;
	const baseDelay = opts?.baseDelay ?? 100;
	for (let attempt = 1; attempt <= maxAttempts; attempt++) try {
		return await fn();
	} catch (err) {
		if (attempt >= maxAttempts) throw err;
		const jitter = Math.random() * baseDelay;
		const delay = baseDelay * Math.pow(2, attempt - 1) + jitter;
		await new Promise((resolve) => setTimeout(resolve, delay));
	}
	throw new Error("Max retries reached; this should be unreachable.");
};

//#endregion
export { createDeferredPromise, createDeferredPromiseWithStack, createTimeoutPromise, resolveAfterPending, resolveNextTick, retryWithBackoff, runAsPromise };
//# sourceMappingURL=promises.js.map