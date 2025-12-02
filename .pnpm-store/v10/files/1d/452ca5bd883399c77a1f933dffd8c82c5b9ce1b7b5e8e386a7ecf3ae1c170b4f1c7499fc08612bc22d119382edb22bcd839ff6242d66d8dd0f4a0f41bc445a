const require_rolldown_runtime = require('./_virtual/rolldown_runtime.js');
const require_types = require('./types.js');
let inngest = require("inngest");
let inngest_experimental = require("inngest/experimental");

//#region src/middleware.ts
const realtimeMiddleware = () => {
	return new inngest.InngestMiddleware({
		name: "publish",
		init({ client }) {
			return { onFunctionRun({ ctx: { runId } }) {
				return { transformInput({ ctx: { step } }) {
					const publish = async (input) => {
						const { topic, channel, data } = await input;
						const store = await (0, inngest_experimental.getAsyncCtx)();
						if (!store) throw new Error("No ALS found, but is required for running `publish()`");
						const publishOpts = {
							topics: [topic],
							channel,
							runId
						};
						const action = async () => {
							const result = await client["inngestApi"].publish(publishOpts, data);
							if (!result.ok) throw new Error(`Failed to publish event: ${result.error?.error}`);
						};
						return (store.executingStep || store.execution?.executingStep ? action() : step.run(`publish:${publishOpts.channel}`, action)).then(() => {
							return data;
						});
					};
					return { ctx: { publish } };
				} };
			} };
		}
	});
};

//#endregion
Object.defineProperty(exports, 'Realtime', {
  enumerable: true,
  get: function () {
    return require_types.Realtime;
  }
});
exports.realtimeMiddleware = realtimeMiddleware;
//# sourceMappingURL=middleware.js.map