import { isMainThread, parentPort } from 'node:worker_threads';
import { i as init } from './init.DMDG-idf.js';

if (isMainThread || !parentPort) throw new Error("Expected worker to be run in node:worker_threads");
function workerInit(options) {
	const { runTests } = options;
	init({
		post: (response) => parentPort.postMessage(response),
		on: (callback) => parentPort.on("message", callback),
		off: (callback) => parentPort.off("message", callback),
		teardown: () => parentPort.removeAllListeners("message"),
		runTests: async (state) => runTests("run", state),
		collectTests: async (state) => runTests("collect", state),
		setup: options.setup
	});
}

export { workerInit as w };
