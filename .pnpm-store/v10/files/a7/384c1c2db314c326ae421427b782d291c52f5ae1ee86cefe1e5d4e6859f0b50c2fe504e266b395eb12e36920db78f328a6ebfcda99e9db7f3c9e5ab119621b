import { W as WorkerGlobalState, B as BirpcOptions, R as RuntimeRPC, a as WorkerSetupContext } from './chunks/worker.d.Dxl5oW0C.js';
import { T as Traces } from './chunks/traces.d.Brik_NWu.js';
import { Awaitable } from '@vitest/utils';
import '@vitest/runner';
import 'vite/module-runner';
import './chunks/environment.d.CrsxCzP1.js';
import '@vitest/snapshot';
import '@vitest/pretty-format';
import '@vitest/utils/diff';

/** @experimental */
declare function runBaseTests(method: "run" | "collect", state: WorkerGlobalState, traces: Traces): Promise<void>;

type WorkerRpcOptions = Pick<BirpcOptions<RuntimeRPC>, "on" | "off" | "post" | "serialize" | "deserialize">;
interface VitestWorker extends WorkerRpcOptions {
	runTests: (state: WorkerGlobalState, traces: Traces) => Awaitable<unknown>;
	collectTests: (state: WorkerGlobalState, traces: Traces) => Awaitable<unknown>;
	setup?: (context: WorkerSetupContext) => Promise<() => Promise<unknown>>;
}

interface Options extends VitestWorker {
	teardown?: () => void;
}
/** @experimental */
declare function init(worker: Options): void;

export { init, runBaseTests };
