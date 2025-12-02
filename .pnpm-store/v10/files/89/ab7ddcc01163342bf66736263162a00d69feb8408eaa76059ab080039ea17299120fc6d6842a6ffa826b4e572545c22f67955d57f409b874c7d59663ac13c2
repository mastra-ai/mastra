import { g as globalApis } from './constants.D_Q9UYh-.js';
import { i as index } from './index.DIFZf73e.js';
import './vi.Bgcdy3bQ.js';
import '@vitest/expect';
import '@vitest/runner';
import '@vitest/runner/utils';
import './utils.DvEY5TfP.js';
import '@vitest/utils/timers';
import '@vitest/snapshot';
import '@vitest/utils/error';
import '@vitest/utils/helpers';
import '@vitest/spy';
import '@vitest/utils/offset';
import '@vitest/utils/source-map';
import './_commonjsHelpers.BFTU3MAI.js';
import './date.Bq6ZW5rf.js';
import './benchmark.B3N2zMcH.js';
import './evaluatedModules.Dg1zASAC.js';
import 'pathe';
import 'vite/module-runner';
import 'expect-type';

function registerApiGlobally() {
	globalApis.forEach((api) => {
		// @ts-expect-error I know what I am doing :P
		globalThis[api] = index[api];
	});
}

export { registerApiGlobally };
