import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import timers from 'node:timers';
import timersPromises from 'node:timers/promises';
import util from 'node:util';
import { startTests, collectTests } from '@vitest/runner';
import { KNOWN_ASSET_TYPES } from '@vitest/utils/constants';
import { s as setupChaiConfig, r as resolveTestRunner, a as resolveSnapshotEnvironment } from '../chunks/index.BY4-tcno.js';
import { c as setupCommonEnv, s as startCoverageInsideWorker, a as stopCoverageInsideWorker } from '../chunks/setup-common.LGjNSzXp.js';
import { i as index } from '../chunks/index.DIFZf73e.js';
import { c as closeInspector } from '../chunks/inspector.CvyFGlXm.js';
import { g as getWorkerState } from '../chunks/utils.DvEY5TfP.js';
import { g as globalExpect } from '../chunks/vi.Bgcdy3bQ.js';
import '@vitest/expect';
import '../chunks/rpc.BUV7uWKJ.js';
import '@vitest/utils/timers';
import '../chunks/index.DAL392Ss.js';
import '../chunks/test.ClrAtjMv.js';
import '@vitest/utils/helpers';
import '../chunks/benchmark.B3N2zMcH.js';
import '@vitest/runner/utils';
import '@vitest/utils/error';
import 'pathe';
import '../chunks/coverage.D_JHT54q.js';
import '@vitest/snapshot';
import '../chunks/evaluatedModules.Dg1zASAC.js';
import 'vite/module-runner';
import 'expect-type';
import 'node:url';
import '@vitest/spy';
import '@vitest/utils/offset';
import '@vitest/utils/source-map';
import '../chunks/_commonjsHelpers.BFTU3MAI.js';
import '../chunks/date.Bq6ZW5rf.js';

async function run(method, files, config, moduleRunner) {
	const workerState = getWorkerState();
	await setupCommonEnv(config);
	Object.defineProperty(globalThis, "__vitest_index__", {
		value: index,
		enumerable: false
	});
	const viteEnvironment = workerState.environment.viteEnvironment || workerState.environment.name;
	globalExpect.setState({ environment: workerState.environment.name });
	if (viteEnvironment === "client") {
		const _require = createRequire(import.meta.url);
		// always mock "required" `css` files, because we cannot process them
		_require.extensions[".css"] = resolveCss;
		_require.extensions[".scss"] = resolveCss;
		_require.extensions[".sass"] = resolveCss;
		_require.extensions[".less"] = resolveCss;
		// since we are using Vite, we can assume how these will be resolved
		KNOWN_ASSET_TYPES.forEach((type) => {
			_require.extensions[`.${type}`] = resolveAsset;
		});
		process.env.SSR = "";
	} else process.env.SSR = "1";
	// @ts-expect-error not typed global for patched timers
	globalThis.__vitest_required__ = {
		util,
		timers,
		timersPromises
	};
	await startCoverageInsideWorker(config.coverage, moduleRunner, { isolate: false });
	if (config.chaiConfig) setupChaiConfig(config.chaiConfig);
	const [runner, snapshotEnvironment] = await Promise.all([resolveTestRunner(config, moduleRunner), resolveSnapshotEnvironment(config, moduleRunner)]);
	config.snapshotOptions.snapshotEnvironment = snapshotEnvironment;
	runner.getWorkerContext = void 0;
	workerState.onCancel((reason) => {
		closeInspector(config);
		runner.cancel?.(reason);
	});
	workerState.durations.prepare = performance.now() - workerState.durations.prepare;
	const { vi } = index;
	for (const file of files) {
		workerState.filepath = file.filepath;
		if (method === "run") await startTests([file], runner);
		else await collectTests([file], runner);
		// reset after tests, because user might call `vi.setConfig` in setupFile
		vi.resetConfig();
		// mocks should not affect different files
		vi.restoreAllMocks();
	}
	await stopCoverageInsideWorker(config.coverage, moduleRunner, { isolate: false });
}
function resolveCss(mod) {
	mod.exports = "";
}
function resolveAsset(mod, url) {
	mod.exports = url;
}

export { run };
