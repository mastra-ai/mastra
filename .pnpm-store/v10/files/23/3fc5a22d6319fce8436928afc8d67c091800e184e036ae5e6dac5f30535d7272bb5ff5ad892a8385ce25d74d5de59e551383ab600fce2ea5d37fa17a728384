import { t as getAsyncLocalStorage } from "./async_hooks-BfRfbd1J.mjs";

//#region src/context/endpoint-context.ts
let currentContextAsyncStorage = null;
const ensureAsyncStorage$2 = async () => {
	if (!currentContextAsyncStorage) currentContextAsyncStorage = new (await (getAsyncLocalStorage()))();
	return currentContextAsyncStorage;
};
/**
* This is for internal use only. Most users should use `getCurrentAuthContext` instead.
*
* It is exposed for advanced use cases where you need direct access to the AsyncLocalStorage instance.
*/
async function getCurrentAuthContextAsyncLocalStorage() {
	return ensureAsyncStorage$2();
}
async function getCurrentAuthContext() {
	const context = (await ensureAsyncStorage$2()).getStore();
	if (!context) throw new Error("No auth context found. Please make sure you are calling this function within a `runWithEndpointContext` callback.");
	return context;
}
async function runWithEndpointContext(context, fn) {
	return (await ensureAsyncStorage$2()).run(context, fn);
}

//#endregion
//#region src/context/request-state.ts
let requestStateAsyncStorage = null;
const ensureAsyncStorage$1 = async () => {
	if (!requestStateAsyncStorage) requestStateAsyncStorage = new (await (getAsyncLocalStorage()))();
	return requestStateAsyncStorage;
};
async function getRequestStateAsyncLocalStorage() {
	return ensureAsyncStorage$1();
}
async function hasRequestState() {
	return (await ensureAsyncStorage$1()).getStore() !== void 0;
}
async function getCurrentRequestState() {
	const store = (await ensureAsyncStorage$1()).getStore();
	if (!store) throw new Error("No request state found. Please make sure you are calling this function within a `runWithRequestState` callback.");
	return store;
}
async function runWithRequestState(store, fn) {
	return (await ensureAsyncStorage$1()).run(store, fn);
}
function defineRequestState(initFn) {
	const ref = Object.freeze({});
	return {
		get ref() {
			return ref;
		},
		async get() {
			const store = await getCurrentRequestState();
			if (!store.has(ref)) {
				const initialValue = await initFn();
				store.set(ref, initialValue);
				return initialValue;
			}
			return store.get(ref);
		},
		async set(value) {
			(await getCurrentRequestState()).set(ref, value);
		}
	};
}

//#endregion
//#region src/context/transaction.ts
let currentAdapterAsyncStorage = null;
const ensureAsyncStorage = async () => {
	if (!currentAdapterAsyncStorage) currentAdapterAsyncStorage = new (await (getAsyncLocalStorage()))();
	return currentAdapterAsyncStorage;
};
/**
* This is for internal use only. Most users should use `getCurrentAdapter` instead.
*
* It is exposed for advanced use cases where you need direct access to the AsyncLocalStorage instance.
*/
const getCurrentDBAdapterAsyncLocalStorage = async () => {
	return ensureAsyncStorage();
};
const getCurrentAdapter = async (fallback) => {
	return ensureAsyncStorage().then((als) => {
		return als.getStore() || fallback;
	}).catch(() => {
		return fallback;
	});
};
const runWithAdapter = async (adapter, fn) => {
	let called = true;
	return ensureAsyncStorage().then((als) => {
		called = true;
		return als.run(adapter, fn);
	}).catch((err) => {
		if (!called) return fn();
		throw err;
	});
};
const runWithTransaction = async (adapter, fn) => {
	let called = true;
	return ensureAsyncStorage().then((als) => {
		called = true;
		return adapter.transaction(async (trx) => {
			return als.run(trx, fn);
		});
	}).catch((err) => {
		if (!called) return fn();
		throw err;
	});
};

//#endregion
export { defineRequestState as a, hasRequestState as c, getCurrentAuthContextAsyncLocalStorage as d, runWithEndpointContext as f, runWithTransaction as i, runWithRequestState as l, getCurrentDBAdapterAsyncLocalStorage as n, getCurrentRequestState as o, runWithAdapter as r, getRequestStateAsyncLocalStorage as s, getCurrentAdapter as t, getCurrentAuthContext as u };