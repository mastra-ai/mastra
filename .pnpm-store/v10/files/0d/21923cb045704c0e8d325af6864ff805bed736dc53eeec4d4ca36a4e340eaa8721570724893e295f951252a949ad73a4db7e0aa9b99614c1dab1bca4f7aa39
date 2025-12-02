import { cacheFn, waterfall } from "../helpers/functions.js";

//#region src/components/InngestMiddleware.ts
/**
* A middleware that can be registered with Inngest to hook into various
* lifecycles of the SDK and affect input and output of Inngest functionality.
*
* See {@link https://innge.st/middleware}
*
* @example
*
* ```ts
* export const inngest = new Inngest({
*   middleware: [
*     new InngestMiddleware({
*       name: "My Middleware",
*       init: () => {
*         // ...
*       }
*     })
*   ]
* });
* ```
*
* @public
*/
var InngestMiddleware = class InngestMiddleware {
	get [Symbol.toStringTag]() {
		return InngestMiddleware.Tag;
	}
	/**
	* The name of this middleware. Used primarily for debugging and logging
	* purposes.
	*/
	name;
	/**
	* This function is used to initialize your middleware and register any hooks
	* you want to use. It will be called once when the SDK is initialized, and
	* should be used to store any state you want to use in other parts of your
	* middleware.
	*
	* It can be synchronous or asynchronous, in which case the client will wait
	* for it to resolve before continuing to initialize the next middleware.
	*
	* Multiple clients could be used in the same application with differing
	* middleware, so do not store state in global variables or assume that your
	* middleware will only be used once.
	*
	* Must return an object detailing the hooks you want to register.
	*/
	init;
	constructor({ name, init }) {
		this.name = name;
		this.init = init;
	}
};
(function(_InngestMiddleware) {
	_InngestMiddleware.Tag = "Inngest.Middleware";
})(InngestMiddleware || (InngestMiddleware = {}));
/**
* Given some middleware and an entrypoint, runs the initializer for the given
* `key` and returns functions that will pass arguments through a stack of each
* given hook in a middleware's lifecycle.
*
* Lets the middleware initialize before starting.
*/
const getHookStack = async (middleware, key, arg, transforms) => {
	const hookDirs = hookDirections[key];
	if (!hookDirs) throw new Error(`No hook directions found for key "${String(key)}". This is likely a bug in the Inngest SDK.`);
	const hooksRegistered = await (await middleware).reduce((acc, mw) => {
		const fn = mw[key];
		if (fn) return [...acc, fn];
		return acc;
	}, []).reduce(async (acc, fn) => {
		return [...await acc, await fn(arg)];
	}, Promise.resolve([]));
	const ret = {};
	for (const hook of hooksRegistered) {
		const hookKeys = Object.keys(hook);
		for (const key$1 of hookKeys) {
			let fns = [hook[key$1]];
			const existingWaterfall = ret[key$1];
			if (existingWaterfall) if (hookDirs[key$1] === "forward") fns = [existingWaterfall, hook[key$1]];
			else fns = [hook[key$1], existingWaterfall];
			const transform = transforms[key$1];
			ret[key$1] = waterfall(fns, transform);
		}
	}
	for (const k of Object.keys(ret)) {
		const key$1 = k;
		ret[key$1] = cacheFn(ret[key$1]);
	}
	return ret;
};
/**
* The direction of each hook that exists in the middleware lifecycle.
* This is used to determine whether hooks found in a stack run forwards or
* backwards, creating onion-like behaviour.
*/
const hookDirections = {
	onFunctionRun: {
		transformInput: "forward",
		beforeMemoization: "forward",
		afterMemoization: "backward",
		beforeExecution: "forward",
		afterExecution: "backward",
		transformOutput: "backward",
		beforeResponse: "forward",
		finished: "forward"
	},
	onSendEvent: {
		transformInput: "forward",
		transformOutput: "backward"
	}
};

//#endregion
export { InngestMiddleware, getHookStack };
//# sourceMappingURL=InngestMiddleware.js.map