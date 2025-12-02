const require_rolldown_runtime = require('../../_virtual/rolldown_runtime.cjs');
const require_consts = require('../../helpers/consts.cjs');
let debug = require("debug");
debug = require_rolldown_runtime.__toESM(debug);

//#region src/components/execution/InngestExecution.ts
var InngestExecution_exports = /* @__PURE__ */ require_rolldown_runtime.__export({
	ExecutionVersion: () => require_consts.ExecutionVersion,
	InngestExecution: () => InngestExecution,
	PREFERRED_EXECUTION_VERSION: () => PREFERRED_EXECUTION_VERSION
});
/**
* The preferred execution version that will be used by the SDK when handling
* brand new runs where the Executor is allowing us to choose.
*
* Changing this should not ever be a breaking change, as this will only change
* new runs, not existing ones.
*/
const PREFERRED_EXECUTION_VERSION = require_consts.ExecutionVersion.V1;
var InngestExecution = class {
	debug;
	constructor(options) {
		this.options = options;
		this.debug = (0, debug.default)(`${require_consts.debugPrefix}:${this.options.runId}`);
	}
};

//#endregion
exports.InngestExecution = InngestExecution;
Object.defineProperty(exports, 'InngestExecution_exports', {
  enumerable: true,
  get: function () {
    return InngestExecution_exports;
  }
});
exports.PREFERRED_EXECUTION_VERSION = PREFERRED_EXECUTION_VERSION;
//# sourceMappingURL=InngestExecution.cjs.map