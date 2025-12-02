const require_rolldown_runtime = require('../_virtual/rolldown_runtime.cjs');
const require_consts = require('../helpers/consts.cjs');
const require_types = require('../types.cjs');
let zod_v3 = require("zod/v3");
zod_v3 = require_rolldown_runtime.__toESM(zod_v3);

//#region src/api/schema.ts
const errorSchema = zod_v3.z.object({
	error: zod_v3.z.string(),
	status: zod_v3.z.number()
});
const v0StepSchema = zod_v3.z.record(zod_v3.z.any().refine((v) => typeof v !== "undefined", { message: "Values in steps must be defined" })).optional().nullable();
const v1StepSchema = zod_v3.z.record(zod_v3.z.object({
	type: zod_v3.z.literal("data").optional().default("data"),
	data: zod_v3.z.any().refine((v) => typeof v !== "undefined", { message: "Data in steps must be defined" })
}).strict().or(zod_v3.z.object({
	type: zod_v3.z.literal("error").optional().default("error"),
	error: require_types.jsonErrorSchema
}).strict()).or(zod_v3.z.object({
	type: zod_v3.z.literal("input").optional().default("input"),
	input: zod_v3.z.any().refine((v) => typeof v !== "undefined", { message: "If input is present it must not be `undefined`" })
}).strict()).or(zod_v3.z.any().transform((v) => ({
	type: "data",
	data: v
})))).default({});
const v2StepSchema = v1StepSchema;
const stepsSchemas = {
	[require_consts.ExecutionVersion.V0]: v0StepSchema,
	[require_consts.ExecutionVersion.V1]: v1StepSchema,
	[require_consts.ExecutionVersion.V2]: v2StepSchema
};
const batchSchema = zod_v3.z.array(zod_v3.z.record(zod_v3.z.any()).transform((v) => v));

//#endregion
exports.batchSchema = batchSchema;
exports.errorSchema = errorSchema;
exports.stepsSchemas = stepsSchemas;
//# sourceMappingURL=schema.cjs.map