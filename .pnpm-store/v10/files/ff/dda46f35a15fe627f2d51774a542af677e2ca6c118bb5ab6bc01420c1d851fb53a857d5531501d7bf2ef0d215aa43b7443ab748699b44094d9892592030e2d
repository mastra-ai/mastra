import { i as init } from './init.D-GGeAxo.js';

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
		runTests: (state, traces) => executeTests("run", state, traces),
		collectTests: (state, traces) => executeTests("collect", state, traces),
		setup: options.setup
	});
	async function executeTests(method, state, traces) {
		try {
			await runTests(method, state, traces);
		} finally {
			process.exit = processExit;
		}
	}
}

export { workerInit as w };
