const require_consts = require('../../helpers/consts.cjs');

//#region src/components/connect/util.ts
var ReconnectError = class extends Error {
	constructor(message, attempt) {
		super(message);
		this.attempt = attempt;
		this.name = "ReconnectError";
	}
};
var AuthError = class extends ReconnectError {
	constructor(message, attempt) {
		super(message, attempt);
		this.name = "AuthError";
	}
};
var ConnectionLimitError = class extends ReconnectError {
	constructor(attempt) {
		super("Connection limit exceeded", attempt);
		this.name = "ConnectionLimitError";
	}
};
function expBackoff(attempt) {
	const backoffTimes = [
		1e3,
		2e3,
		5e3,
		1e4,
		2e4,
		3e4,
		6e4,
		12e4,
		3e5
	];
	return backoffTimes[Math.min(attempt, backoffTimes.length - 1)] ?? 6e4;
}
/**
* Wait for a given amount of time, but cancel if the given condition is true.
*
* Returns `true` if the condition was met, `false` if the timeout was reached.
*/
function waitWithCancel(ms, cancelIf) {
	return new Promise((resolve) => {
		const startTime = Date.now();
		const interval = setInterval(() => {
			if (cancelIf()) {
				clearInterval(interval);
				resolve(true);
				return;
			}
			if (Date.now() - startTime >= ms) {
				clearInterval(interval);
				resolve(false);
				return;
			}
		}, 100);
	});
}
function isObject(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isString(value) {
	return typeof value === "string";
}
function parseTraceCtx(serializedTraceCtx) {
	const parsedTraceCtx = serializedTraceCtx.length > 0 ? JSON.parse(new TextDecoder().decode(serializedTraceCtx)) : null;
	if (!isObject(parsedTraceCtx)) return null;
	const traceParent = parsedTraceCtx[require_consts.headerKeys.TraceParent];
	if (!isString(traceParent)) return null;
	const traceState = parsedTraceCtx[require_consts.headerKeys.TraceState];
	if (!isString(traceState)) return null;
	return {
		traceParent,
		traceState
	};
}

//#endregion
exports.AuthError = AuthError;
exports.ConnectionLimitError = ConnectionLimitError;
exports.ReconnectError = ReconnectError;
exports.expBackoff = expBackoff;
exports.parseTraceCtx = parseTraceCtx;
exports.waitWithCancel = waitWithCancel;
//# sourceMappingURL=util.cjs.map