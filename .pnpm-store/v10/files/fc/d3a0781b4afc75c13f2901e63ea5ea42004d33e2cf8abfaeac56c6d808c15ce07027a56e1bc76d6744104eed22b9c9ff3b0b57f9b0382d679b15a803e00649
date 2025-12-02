
//#region src/components/execution/als.ts
/**
* A local-only symbol used as a key in global state to store the async local
* storage instance.
*/
const alsSymbol = Symbol.for("inngest:als");
/**
* Retrieve the async context for the current execution.
*/
const getAsyncCtx = async () => {
	return getAsyncLocalStorage().then((als) => als.getStore());
};
/**
* Get a singleton instance of `AsyncLocalStorage` used to store and retrieve
* async context for the current execution.
*/
const getAsyncLocalStorage = async () => {
	globalThis[alsSymbol] ??= new Promise(async (resolve) => {
		try {
			const { AsyncLocalStorage } = await import("node:async_hooks");
			resolve(new AsyncLocalStorage());
		} catch (_err) {
			console.warn("node:async_hooks is not supported in this runtime. Experimental async context is disabled.");
			resolve({
				getStore: () => void 0,
				run: (_, fn) => fn()
			});
		}
	});
	return globalThis[alsSymbol];
};

//#endregion
exports.getAsyncCtx = getAsyncCtx;
exports.getAsyncLocalStorage = getAsyncLocalStorage;
//# sourceMappingURL=als.cjs.map