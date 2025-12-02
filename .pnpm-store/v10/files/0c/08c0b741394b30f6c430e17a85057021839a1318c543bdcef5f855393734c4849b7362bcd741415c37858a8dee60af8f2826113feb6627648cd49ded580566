import { Realtime } from "./types.mjs";
import { InngestMiddleware } from "inngest";
import { getAsyncCtx } from "inngest/experimental";

//#region src/middleware.ts
const realtimeMiddleware = () => {
	return new InngestMiddleware({
		name: "publish",
		init({ client }) {
			return { onFunctionRun({ ctx: { runId } }) {
				return { transformInput({ ctx: { step } }) {
					const publish = async (input) => {
						const { topic, channel, data } = await input;
						const store = await getAsyncCtx();
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
export { Realtime, realtimeMiddleware };
//# sourceMappingURL=middleware.mjs.map