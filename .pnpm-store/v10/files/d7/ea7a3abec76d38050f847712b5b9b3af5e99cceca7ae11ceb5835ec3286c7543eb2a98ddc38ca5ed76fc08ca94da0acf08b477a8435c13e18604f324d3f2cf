import v8 from 'node:v8';
import { i as init } from './init.DMDG-idf.js';

if (!process.send) throw new Error("Expected worker to be run in node:child_process");
// Store globals in case tests overwrite them
const processExit = process.exit.bind(process);
const processSend = process.send.bind(process);
const processOn = process.on.bind(process);
const processOff = process.off.bind(process);
const processRemoveAllListeners = process.removeAllListeners.bind(process);
// Work-around for nodejs/node#55094
if (process.execArgv.some((execArg) => execArg.startsWith("--prof") || execArg.startsWith("--cpu-prof") || execArg.startsWith("--heap-prof") || execArg.startsWith("--diagnostic-dir"))) processOn("SIGTERM", () => processExit());
function workerInit(options) {
	const { runTests } = options;
	init({
		post: (v) => processSend(v),
		on: (cb) => processOn("message", cb),
		off: (cb) => processOff("message", cb),
		teardown: () => processRemoveAllListeners("message"),
		serialize: v8.serialize,
		deserialize: (v) => v8.deserialize(Buffer.from(v)),
		runTests: (state) => executeTests("run", state),
		collectTests: (state) => executeTests("collect", state),
		setup: options.setup
	});
	async function executeTests(method, state) {
		state.ctx.config = unwrapSerializableConfig(state.ctx.config);
		try {
			await runTests(method, state);
		} finally {
			process.exit = processExit;
		}
	}
}
/**
* Reverts the wrapping done by `wrapSerializableConfig` in {@link file://./../../node/pool/runtimes/forks.ts}
*/
function unwrapSerializableConfig(config) {
	if (config.testNamePattern && typeof config.testNamePattern === "string") {
		const testNamePattern = config.testNamePattern;
		if (testNamePattern.startsWith("$$vitest:")) config.testNamePattern = parseRegexp(testNamePattern.slice(9));
	}
	if (config.defines && Array.isArray(config.defines.keys) && config.defines.original) {
		const { keys, original } = config.defines;
		const defines = {};
		// Apply all keys from the original. Entries which had undefined value are missing from original now
		for (const key of keys) defines[key] = original[key];
		config.defines = defines;
	}
	return config;
}
function parseRegexp(input) {
	// Parse input
	// eslint-disable-next-line regexp/no-misleading-capturing-group
	const m = input.match(/(\/?)(.+)\1([a-z]*)/i);
	// match nothing
	if (!m) return /$^/;
	// Invalid flags
	// eslint-disable-next-line regexp/optimal-quantifier-concatenation
	if (m[3] && !/^(?!.*?(.).*?\1)[gmixXsuUAJ]+$/.test(m[3])) return new RegExp(input);
	// Create the regular expression
	return new RegExp(m[2], m[3]);
}

export { workerInit as w };
