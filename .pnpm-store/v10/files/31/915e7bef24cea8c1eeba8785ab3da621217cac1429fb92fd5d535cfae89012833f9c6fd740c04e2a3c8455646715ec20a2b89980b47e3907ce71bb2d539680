import { z } from "zod/v3";

//#region src/types.ts
let Realtime;
(function(_Realtime) {
	_Realtime.messageSchema = z.object({
		channel: z.string().optional(),
		topic: z.string().optional(),
		data: z.any(),
		run_id: z.string().optional(),
		fn_id: z.string().optional(),
		created_at: z.string().optional().transform((v) => v ? new Date(v) : void 0),
		env_id: z.string().optional(),
		stream_id: z.string().optional(),
		kind: z.enum([
			"step",
			"run",
			"data",
			"ping",
			"pong",
			"closing",
			"event",
			"sub",
			"unsub",
			"datastream-start",
			"datastream-end",
			"chunk"
		])
	}).transform(({ data,...rest }) => {
		return {
			...rest,
			data: data ?? void 0
		};
	});
})(Realtime || (Realtime = {}));

//#endregion
export { Realtime };
//# sourceMappingURL=types.mjs.map