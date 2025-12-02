import { a as SerializedCoverageConfig, S as SerializedConfig } from './chunks/config.d.BTfZNUu9.js';
import { R as RuntimeCoverageModuleLoader } from './chunks/coverage.d.BZtK59WP.js';
import { SerializedDiffOptions } from '@vitest/utils/diff';
import { V as VitestModuleRunner } from './chunks/moduleRunner.d.CzOZ_4wC.js';
export { collectTests, startTests } from '@vitest/runner';
import * as _vitest_spy from '@vitest/spy';
export { _vitest_spy as SpyModule };
export { LoupeOptions, ParsedStack, StringifyOptions } from '@vitest/utils';
export { format, inspect, stringify } from '@vitest/utils/display';
export { processError } from '@vitest/utils/error';
export { getType } from '@vitest/utils/helpers';
export { DecodedMap, getOriginalPosition } from '@vitest/utils/source-map';
export { getSafeTimers, setSafeTimers } from '@vitest/utils/timers';
import '@vitest/pretty-format';
import '@vitest/snapshot';
import 'node:vm';
import 'vite/module-runner';
import './chunks/worker.d.DadbA89M.js';
import './chunks/environment.d.CrsxCzP1.js';
import '@vitest/mocker';
import './chunks/mocker.d.BE_2ls6u.js';

declare function startCoverageInsideWorker(options: SerializedCoverageConfig | undefined, loader: RuntimeCoverageModuleLoader, runtimeOptions: {
	isolate: boolean;
}): Promise<unknown>;
declare function takeCoverageInsideWorker(options: SerializedCoverageConfig | undefined, loader: RuntimeCoverageModuleLoader): Promise<unknown>;
declare function stopCoverageInsideWorker(options: SerializedCoverageConfig | undefined, loader: RuntimeCoverageModuleLoader, runtimeOptions: {
	isolate: boolean;
}): Promise<unknown>;

declare function setupCommonEnv(config: SerializedConfig): Promise<void>;
declare function loadDiffConfig(config: SerializedConfig, moduleRunner: VitestModuleRunner): Promise<SerializedDiffOptions | undefined>;
declare function loadSnapshotSerializers(config: SerializedConfig, moduleRunner: VitestModuleRunner): Promise<void>;

interface FsOptions {
	encoding?: BufferEncoding;
	flag?: string | number;
}
interface BrowserCommands {
	readFile: (path: string, options?: BufferEncoding | FsOptions) => Promise<string>;
	writeFile: (path: string, content: string, options?: BufferEncoding | (FsOptions & {
		mode?: number | string;
	})) => Promise<void>;
	removeFile: (path: string) => Promise<void>;
}

export { loadDiffConfig, loadSnapshotSerializers, setupCommonEnv, startCoverageInsideWorker, stopCoverageInsideWorker, takeCoverageInsideWorker };
export type { BrowserCommands, FsOptions };
