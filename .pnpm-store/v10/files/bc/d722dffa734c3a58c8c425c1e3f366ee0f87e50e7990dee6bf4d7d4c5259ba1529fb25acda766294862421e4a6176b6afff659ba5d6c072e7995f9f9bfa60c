import { ExecutionVersion } from "../helpers/consts.js";
import { jsonErrorSchema } from "../types.js";
import { z } from "zod/v3";

//#region src/api/schema.ts
const errorSchema = z.object({
	error: z.string(),
	status: z.number()
});
const v0StepSchema = z.record(z.any().refine((v) => typeof v !== "undefined", { message: "Values in steps must be defined" })).optional().nullable();
const v1StepSchema = z.record(z.object({
	type: z.literal("data").optional().default("data"),
	data: z.any().refine((v) => typeof v !== "undefined", { message: "Data in steps must be defined" })
}).strict().or(z.object({
	type: z.literal("error").optional().default("error"),
	error: jsonErrorSchema
}).strict()).or(z.object({
	type: z.literal("input").optional().default("input"),
	input: z.any().refine((v) => typeof v !== "undefined", { message: "If input is present it must not be `undefined`" })
}).strict()).or(z.any().transform((v) => ({
	type: "data",
	data: v
})))).default({});
const v2StepSchema = v1StepSchema;
const stepsSchemas = {
	[ExecutionVersion.V0]: v0StepSchema,
	[ExecutionVersion.V1]: v1StepSchema,
	[ExecutionVersion.V2]: v2StepSchema
};
const batchSchema = z.array(z.record(z.any()).transform((v) => v));

//#endregion
export { batchSchema, errorSchema, stepsSchemas };
//# sourceMappingURL=schema.js.map