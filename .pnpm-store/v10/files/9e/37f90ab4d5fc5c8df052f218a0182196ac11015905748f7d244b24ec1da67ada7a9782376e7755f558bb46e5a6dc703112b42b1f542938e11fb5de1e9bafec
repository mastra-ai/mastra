const SAFE_TIMERS_SYMBOL = Symbol("vitest:SAFE_TIMERS");
function getSafeTimers() {
	const { setTimeout: safeSetTimeout, setInterval: safeSetInterval, clearInterval: safeClearInterval, clearTimeout: safeClearTimeout, setImmediate: safeSetImmediate, clearImmediate: safeClearImmediate, queueMicrotask: safeQueueMicrotask } = globalThis[SAFE_TIMERS_SYMBOL] || globalThis;
	const { nextTick: safeNextTick } = globalThis[SAFE_TIMERS_SYMBOL] || globalThis.process || {};
	return {
		nextTick: safeNextTick,
		setTimeout: safeSetTimeout,
		setInterval: safeSetInterval,
		clearInterval: safeClearInterval,
		clearTimeout: safeClearTimeout,
		setImmediate: safeSetImmediate,
		clearImmediate: safeClearImmediate,
		queueMicrotask: safeQueueMicrotask
	};
}
function setSafeTimers() {
	const { setTimeout: safeSetTimeout, setInterval: safeSetInterval, clearInterval: safeClearInterval, clearTimeout: safeClearTimeout, setImmediate: safeSetImmediate, clearImmediate: safeClearImmediate, queueMicrotask: safeQueueMicrotask } = globalThis;
	const { nextTick: safeNextTick } = globalThis.process || {};
	const timers = {
		nextTick: safeNextTick,
		setTimeout: safeSetTimeout,
		setInterval: safeSetInterval,
		clearInterval: safeClearInterval,
		clearTimeout: safeClearTimeout,
		setImmediate: safeSetImmediate,
		clearImmediate: safeClearImmediate,
		queueMicrotask: safeQueueMicrotask
	};
	globalThis[SAFE_TIMERS_SYMBOL] = timers;
}

export { getSafeTimers, setSafeTimers };
