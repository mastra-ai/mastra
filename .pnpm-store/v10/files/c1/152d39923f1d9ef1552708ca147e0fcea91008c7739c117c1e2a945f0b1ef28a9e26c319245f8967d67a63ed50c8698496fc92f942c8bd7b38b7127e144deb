const require_rolldown_runtime = require('./_virtual/rolldown_runtime.js');
let zod_v3 = require("zod/v3");

//#region src/types.ts
let Realtime;
(function(_Realtime) {
	_Realtime.messageSchema = zod_v3.z.object({
		channel: zod_v3.z.string().optional(),
		topic: zod_v3.z.string().optional(),
		data: zod_v3.z.any(),
		run_id: zod_v3.z.string().optional(),
		fn_id: zod_v3.z.string().optional(),
		created_at: zod_v3.z.string().optional().transform((v) => v ? new Date(v) : void 0),
		env_id: zod_v3.z.string().optional(),
		stream_id: zod_v3.z.string().optional(),
		kind: zod_v3.z.enum([
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
Object.defineProperty(exports, 'Realtime', {
  enumerable: true,
  get: function () {
    return Realtime;
  }
});
//# sourceMappingURL=types.js.map