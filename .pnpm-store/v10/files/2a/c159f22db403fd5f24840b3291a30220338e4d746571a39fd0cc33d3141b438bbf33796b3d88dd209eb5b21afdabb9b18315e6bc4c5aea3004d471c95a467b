import inspector from 'node:inspector/promises';
import { fileURLToPath } from 'node:url';
import { provider } from 'std-env';
import { l as loadProvider } from './load-provider-CdgAx3rL.js';
import { n as normalize } from './pathe.M-eThtNZ-BTaAGrLg.js';

const session = new inspector.Session();
let enabled = false;
const mod = {
	async startCoverage({ isolate }) {
		if (isolate === false && enabled) {
			return;
		}
		enabled = true;
		session.connect();
		await session.post("Profiler.enable");
		await session.post("Profiler.startPreciseCoverage", {
			callCount: true,
			detailed: true
		});
	},
	async takeCoverage(options) {
		if (provider === "stackblitz") {
			return { result: [] };
		}
		const coverage = await session.post("Profiler.takePreciseCoverage");
		const result = [];
		// Reduce amount of data sent over rpc by doing some early result filtering
		for (const entry of coverage.result) {
			if (filterResult(entry)) {
				result.push({
					...entry,
					startOffset: options?.moduleExecutionInfo?.get(normalize(fileURLToPath(entry.url)))?.startOffset || 0
				});
			}
		}
		return { result };
	},
	async stopCoverage({ isolate }) {
		if (isolate === false) {
			return;
		}
		await session.post("Profiler.stopPreciseCoverage");
		await session.post("Profiler.disable");
		session.disconnect();
	},
	async getProvider() {
		return loadProvider();
	}
};
function filterResult(coverage) {
	if (!coverage.url.startsWith("file://")) {
		return false;
	}
	if (coverage.url.includes("/node_modules/")) {
		return false;
	}
	return true;
}

export { mod as default };
