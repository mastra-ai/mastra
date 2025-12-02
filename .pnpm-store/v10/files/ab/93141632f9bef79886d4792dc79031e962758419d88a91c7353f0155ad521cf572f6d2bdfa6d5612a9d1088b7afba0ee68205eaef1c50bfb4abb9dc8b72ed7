const require_rolldown_runtime = require('../_virtual/rolldown_runtime.cjs');
const require_NonRetriableError = require('../components/NonRetriableError.cjs');
let zod_v3 = require("zod/v3");
zod_v3 = require_rolldown_runtime.__toESM(zod_v3);
let chalk = require("chalk");
chalk = require_rolldown_runtime.__toESM(chalk);
let json_stringify_safe = require("json-stringify-safe");
json_stringify_safe = require_rolldown_runtime.__toESM(json_stringify_safe);
let serialize_error_cjs = require("serialize-error-cjs");
serialize_error_cjs = require_rolldown_runtime.__toESM(serialize_error_cjs);
let strip_ansi = require("strip-ansi");
strip_ansi = require_rolldown_runtime.__toESM(strip_ansi);

//#region src/helpers/errors.ts
var errors_exports = /* @__PURE__ */ require_rolldown_runtime.__export({
	ErrCode: () => ErrCode,
	OutgoingResultError: () => OutgoingResultError,
	deserializeError: () => deserializeError,
	fixEventKeyMissingSteps: () => fixEventKeyMissingSteps,
	functionStoppedRunningErr: () => functionStoppedRunningErr,
	getErrorMessage: () => getErrorMessage,
	isSerializedError: () => isSerializedError,
	minifyPrettyError: () => minifyPrettyError,
	prettyError: () => prettyError,
	prettyErrorSplitter: () => prettyErrorSplitter,
	rethrowError: () => rethrowError,
	serializeError: () => serializeError
});
const SERIALIZED_KEY = "__serialized";
const SERIALIZED_VALUE = true;
/**
* Add first-class support for certain errors that we control, in addition to
* built-in errors such as `TypeError`.
*
* Adding these allows these non-standard errors to be correctly serialized,
* sent to Inngest, then deserialized back into the correct error type for users
* to react to correctly.
*
* Note that these errors only support `message?: string | undefined` as the
* input; more custom errors are not supported with this current strategy.
*/
serialize_error_cjs.errorConstructors.set("NonRetriableError", require_NonRetriableError.NonRetriableError);
/**
* Serialise an error to a serialized JSON string.
*
* Errors do not serialise nicely to JSON, so we use this function to convert
* them to a serialized JSON string. Doing this is also non-trivial for some
* errors, so we use the `serialize-error` package to do it for us.
*
* See {@link https://www.npmjs.com/package/serialize-error}
*
* This function is a small wrapper around that package to also add a `type`
* property to the serialised error, so that we can distinguish between
* serialised errors and other objects.
*
* Will not reserialise existing serialised errors.
*/
const serializeError = (subject, allowUnknown = false) => {
	try {
		const existingSerializedError = isSerializedError(subject);
		if (existingSerializedError) return existingSerializedError;
		if (typeof subject === "object" && subject !== null) {
			const serializedErr = (0, serialize_error_cjs.serializeError)(subject);
			if (!serializedErr.name && allowUnknown) return subject;
			const ret = {
				...serializedErr,
				name: serializedErr.name || "Error",
				message: serializedErr.message || (0, json_stringify_safe.default)(subject) || "Unknown error; error serialization could not find a message.",
				stack: serializedErr.stack || "",
				[SERIALIZED_KEY]: SERIALIZED_VALUE
			};
			let target = ret;
			const maxDepth = 5;
			for (let i = 0; i < maxDepth; i++) {
				if (typeof target === "object" && target !== null && "cause" in target && target.cause) {
					target = target.cause = serializeError(target.cause, true);
					continue;
				}
				break;
			}
			return ret;
		}
		throw new Error("Error is not an object; strange throw value.");
	} catch {
		if (allowUnknown) return subject;
		try {
			return {
				...serializeError(new Error(typeof subject === "string" ? subject : (0, json_stringify_safe.default)(subject)), false),
				stack: "",
				[SERIALIZED_KEY]: SERIALIZED_VALUE
			};
		} catch {
			return {
				name: "Could not serialize source error",
				message: "Serializing the source error failed.",
				stack: "",
				[SERIALIZED_KEY]: SERIALIZED_VALUE
			};
		}
	}
};
/**
* Check if an object or a string is a serialised error created by
* {@link serializeError}.
*/
const isSerializedError = (value) => {
	try {
		if (typeof value === "string") {
			const parsed = zod_v3.z.object({
				[SERIALIZED_KEY]: zod_v3.z.literal(SERIALIZED_VALUE),
				name: zod_v3.z.enum([...Array.from(serialize_error_cjs.errorConstructors.keys())]),
				message: zod_v3.z.string(),
				stack: zod_v3.z.string()
			}).passthrough().safeParse(JSON.parse(value));
			if (parsed.success) return parsed.data;
		}
		if (typeof value === "object" && value !== null) {
			if (Object.hasOwn(value, SERIALIZED_KEY) && value[SERIALIZED_KEY] === SERIALIZED_VALUE) return value;
		}
	} catch {}
};
/**
* Deserialise an error created by {@link serializeError}.
*
* Ensures we only deserialise errors that meet a minimum level of
* applicability, inclusive of error handling to ensure that badly serialized
* errors are still handled.
*/
const deserializeError = (subject, allowUnknown = false) => {
	const requiredFields = ["name", "message"];
	try {
		if (!requiredFields.every((field) => {
			return Object.hasOwn(subject, field);
		})) throw new Error();
		const deserializedErr = (0, serialize_error_cjs.deserializeError)(subject);
		if ("cause" in deserializedErr) deserializedErr.cause = deserializeError(deserializedErr.cause, true);
		return deserializedErr;
	} catch {
		if (allowUnknown) return subject;
		const err = /* @__PURE__ */ new Error("Unknown error; could not reserialize");
		/**
		* Remove the stack so that it's not misleadingly shown as the Inngest
		* internals.
		*/
		err.stack = void 0;
		return err;
	}
};
let ErrCode = /* @__PURE__ */ function(ErrCode$1) {
	ErrCode$1["NESTING_STEPS"] = "NESTING_STEPS";
	/**
	* Legacy v0 execution error code for when a function has changed and no
	* longer matches its in-progress state.
	*
	* @deprecated Not for use in latest execution method.
	*/
	ErrCode$1["NON_DETERMINISTIC_FUNCTION"] = "NON_DETERMINISTIC_FUNCTION";
	/**
	* Legacy v0 execution error code for when a function is found to be using
	* async actions after memoziation has occurred, which v0 doesn't support.
	*
	* @deprecated Not for use in latest execution method.
	*/
	ErrCode$1["ASYNC_DETECTED_AFTER_MEMOIZATION"] = "ASYNC_DETECTED_AFTER_MEMOIZATION";
	/**
	* Legacy v0 execution error code for when a function is found to be using
	* steps after a non-step async action has occurred.
	*
	* @deprecated Not for use in latest execution method.
	*/
	ErrCode$1["STEP_USED_AFTER_ASYNC"] = "STEP_USED_AFTER_ASYNC";
	ErrCode$1["AUTOMATIC_PARALLEL_INDEXING"] = "AUTOMATIC_PARALLEL_INDEXING";
	return ErrCode$1;
}({});
const prettyErrorSplitter = "=================================================";
/**
* Given an unknown `err`, mutate it to minify any pretty errors that it
* contains.
*/
const minifyPrettyError = (err) => {
	try {
		if (!isError(err)) return err;
		if (!err.message.includes(prettyErrorSplitter)) return err;
		const sanitizedMessage = (0, strip_ansi.default)(err.message);
		const message = sanitizedMessage.split("  ")[1]?.split("\n")[0]?.trim() || err.message;
		err.message = [sanitizedMessage.split("\n\nCode: ")[1]?.split("\n\n")[0]?.trim() || void 0, message].filter(Boolean).join(" - ");
		if (err.stack) {
			const stackRest = (0, strip_ansi.default)(err.stack).split(`${prettyErrorSplitter}\n`).slice(2).join("\n");
			err.stack = `${err.name}: ${err.message}\n${stackRest}`;
		}
		return err;
	} catch (_noopErr) {
		return err;
	}
};
/**
* Given an `err`, return a boolean representing whether it is in the shape of
* an `Error` or not.
*/
const isError = (err) => {
	try {
		if (err instanceof Error) return true;
		if (typeof err !== "object" || err === null) return false;
		return Object.hasOwn(err, "name") && Object.hasOwn(err, "message");
	} catch (_noopErr) {
		return false;
	}
};
/**
* Given an `unknown` object, retrieve the `message` property from it, or fall
* back to the `fallback` string if it doesn't exist or is empty.
*/
const getErrorMessage = (err, fallback) => {
	const { message } = zod_v3.z.object({ message: zod_v3.z.string().min(1) }).catch({ message: fallback }).parse(err);
	return message;
};
/**
* Given a {@link PrettyError}, return a nicely-formatted string ready to log
* or throw.
*
* Useful for ensuring that errors are logged in a consistent, helpful format
* across the SDK by prompting for key pieces of information.
*/
const prettyError = ({ type = "error", whatHappened, otherwise, reassurance, toFixNow, why, consequences, stack, code }) => {
	const { icon, colorFn } = {
		error: {
			icon: "❌",
			colorFn: chalk.default.red
		},
		warn: {
			icon: "⚠️",
			colorFn: chalk.default.yellow
		}
	}[type];
	let header = `${icon}  ${chalk.default.bold.underline(whatHappened.trim())}`;
	if (stack) header += "\n" + [...(/* @__PURE__ */ new Error()).stack?.split("\n").slice(1).filter(Boolean) || []].join("\n");
	let toFixNowStr = (Array.isArray(toFixNow) ? toFixNow.map((s) => s.trim()).filter(Boolean).map((s, i) => `\t${i + 1}. ${s}`).join("\n") : toFixNow?.trim()) ?? "";
	if (Array.isArray(toFixNow) && toFixNowStr) toFixNowStr = `To fix this, you can take one of the following courses of action:\n\n${toFixNowStr}`;
	let body = [
		reassurance?.trim(),
		why?.trim(),
		consequences?.trim()
	].filter(Boolean).join(" ");
	body += body ? `\n\n${toFixNowStr}` : toFixNowStr;
	const trailer = [otherwise?.trim()].filter(Boolean).join(" ");
	const message = [
		prettyErrorSplitter,
		header,
		body,
		trailer,
		code ? `Code: ${code}` : "",
		prettyErrorSplitter
	].filter(Boolean).join("\n\n");
	return colorFn(message);
};
const fixEventKeyMissingSteps = [
	"Set the `INNGEST_EVENT_KEY` environment variable",
	`Pass a key to the \`new Inngest()\` constructor using the \`eventKey\` option`,
	`Use \`inngest.setEventKey()\` at runtime`
];
/**
* An error that, when thrown, indicates internally that an outgoing operation
* contains an error.
*
* We use this because serialized `data` sent back to Inngest may differ from
* the error instance itself due to middleware.
*
* @internal
*/
var OutgoingResultError = class extends Error {
	result;
	constructor(result) {
		super("OutgoingOpError");
		this.result = result;
	}
};
/**
* Create a function that will rethrow an error with a prefix added to the
* message.
*
* Useful for adding context to errors that are rethrown.
*
* @example
* ```ts
* await doSomeAction().catch(rethrowError("Failed to do some action"));
* ```
*/
const rethrowError = (prefix) => {
	return (err) => {
		try {
			err.message &&= `${prefix}; ${err.message}`;
		} catch (_noopErr) {} finally {
			throw err;
		}
	};
};
/**
* Legacy v0 execution error for functions that don't support mixing steps and
* regular async actions.
*/
const functionStoppedRunningErr = (code) => {
	return prettyError({
		whatHappened: "Your function was stopped from running",
		why: "We detected a mix of asynchronous logic, some using step tooling and some not.",
		consequences: "This can cause unexpected behaviour when a function is paused and resumed and is therefore strongly discouraged; we stopped your function to ensure nothing unexpected happened!",
		stack: true,
		toFixNow: "Ensure that your function is either entirely step-based or entirely non-step-based, by either wrapping all asynchronous logic in `step.run()` calls or by removing all `step.*()` calls.",
		otherwise: "For more information on why step functions work in this manner, see https://www.inngest.com/docs/functions/multi-step#gotchas",
		code
	});
};

//#endregion
exports.ErrCode = ErrCode;
exports.deserializeError = deserializeError;
Object.defineProperty(exports, 'errors_exports', {
  enumerable: true,
  get: function () {
    return errors_exports;
  }
});
exports.fixEventKeyMissingSteps = fixEventKeyMissingSteps;
exports.functionStoppedRunningErr = functionStoppedRunningErr;
exports.getErrorMessage = getErrorMessage;
exports.minifyPrettyError = minifyPrettyError;
exports.prettyError = prettyError;
exports.rethrowError = rethrowError;
exports.serializeError = serializeError;
//# sourceMappingURL=errors.cjs.map