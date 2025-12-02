import { W as WorkerGlobalState, B as BirpcOptions, R as RuntimeRPC, a as WorkerSetupContext } from './chunks/worker.d.DadbA89M.js';
import { Awaitable } from '@vitest/utils';
import '@vitest/runner';
import 'vite/module-runner';
import './chunks/config.d.BTfZNUu9.js';
import '@vitest/pretty-format';
import '@vitest/snapshot';
import '@vitest/utils/diff';
import './chunks/environment.d.CrsxCzP1.js';

/** @experimental */
declare function runBaseTests(method: "run" | "collect", state: WorkerGlobalState): Promise<void>;

type WorkerRpcOptions = Pick<BirpcOptions<RuntimeRPC>, "on" | "off" | "post" | "serialize" | "deserialize">;
interface VitestWorker extends WorkerRpcOptions {
	runTests: (state: WorkerGlobalState) => Awaitable<unknown>;
	collectTests: (state: WorkerGlobalState) => Awaitable<unknown>;
	setup?: (context: WorkerSetupContext) => Promise<() => Promise<unknown>>;
}

interface Options extends VitestWorker {
	teardown?: () => void;
}
/** @experimental */
declare function init(worker: Options): void;

export { init, runBaseTests };
