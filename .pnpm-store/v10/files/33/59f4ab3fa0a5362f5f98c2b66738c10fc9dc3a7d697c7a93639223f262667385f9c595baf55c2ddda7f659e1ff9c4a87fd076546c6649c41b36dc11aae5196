//#region src/util.ts
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
* Send an HTTP request with the given signing key. If the response is a 401 or
* 403, then try again with the fallback signing key
*/
async function fetchWithAuthFallback({ authToken, authTokenFallback, fetch, options, url }) {
	let res = await fetch(url, {
		...options,
		headers: {
			...options?.headers,
			...authToken ? { Authorization: `Bearer ${authToken}` } : {}
		}
	});
	if ([401, 403].includes(res.status) && authTokenFallback) res = await fetch(url, {
		...options,
		headers: {
			...options?.headers,
			Authorization: `Bearer ${authTokenFallback}`
		}
	});
	return res;
}
/**
* Given an unknown value, try to parse it as a `boolean`. Useful for parsing
* environment variables that could be a selection of different values such as
* `"true"`, `"1"`.
*
* If the value could not be confidently parsed as a `boolean` or was seen to be
* `undefined`, this function returns `undefined`.
*/
const parseAsBoolean = (value) => {
	if (typeof value === "boolean") return value;
	if (typeof value === "number") return Boolean(value);
	if (typeof value === "string") {
		const trimmed = value.trim().toLowerCase();
		if (trimmed === "undefined") return;
		if (["true", "1"].includes(trimmed)) return true;
		return false;
	}
};

//#endregion
export { createDeferredPromise, fetchWithAuthFallback, parseAsBoolean };
//# sourceMappingURL=util.mjs.map