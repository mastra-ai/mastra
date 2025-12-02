import { ExecutionVersion } from "../helpers/consts.js";
import { EventPayload, JsonError } from "../types.js";
import { z } from "zod/v3";

//#region src/api/schema.d.ts
declare const errorSchema: z.ZodObject<{
  error: z.ZodString;
  status: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
  error: string;
  status: number;
}, {
  error: string;
  status: number;
}>;
type ErrorResponse = z.infer<typeof errorSchema>;
declare const stepsSchemas: {
  0: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodEffects<z.ZodAny, any, any>>>>;
  1: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodObject<{
    type: z.ZodDefault<z.ZodOptional<z.ZodLiteral<"data">>>;
    data: z.ZodEffects<z.ZodAny, any, any>;
  }, "strict", z.ZodTypeAny, {
    type: "data";
    data?: any;
  }, {
    type?: "data" | undefined;
    data?: any;
  }>, z.ZodObject<{
    type: z.ZodDefault<z.ZodOptional<z.ZodLiteral<"error">>>;
    error: z.ZodType<JsonError, z.ZodTypeDef, JsonError>;
  }, "strict", z.ZodTypeAny, {
    error: {
      error?: string | undefined;
      name?: string | undefined;
      message?: string | undefined;
      stack?: string | undefined;
    } & {
      name: string;
      message: string;
      cause?: unknown;
    };
    type: "error";
  }, {
    error: {
      error?: string | undefined;
      name?: string | undefined;
      message?: string | undefined;
      stack?: string | undefined;
    } & {
      name: string;
      message: string;
      cause?: unknown;
    };
    type?: "error" | undefined;
  }>]>, z.ZodObject<{
    type: z.ZodDefault<z.ZodOptional<z.ZodLiteral<"input">>>;
    input: z.ZodEffects<z.ZodAny, any, any>;
  }, "strict", z.ZodTypeAny, {
    type: "input";
    input?: any;
  }, {
    type?: "input" | undefined;
    input?: any;
  }>]>, z.ZodEffects<z.ZodAny, {
    type: "data";
    data: any;
  }, any>]>>>;
  2: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodObject<{
    type: z.ZodDefault<z.ZodOptional<z.ZodLiteral<"data">>>;
    data: z.ZodEffects<z.ZodAny, any, any>;
  }, "strict", z.ZodTypeAny, {
    type: "data";
    data?: any;
  }, {
    type?: "data" | undefined;
    data?: any;
  }>, z.ZodObject<{
    type: z.ZodDefault<z.ZodOptional<z.ZodLiteral<"error">>>;
    error: z.ZodType<JsonError, z.ZodTypeDef, JsonError>;
  }, "strict", z.ZodTypeAny, {
    error: {
      error?: string | undefined;
      name?: string | undefined;
      message?: string | undefined;
      stack?: string | undefined;
    } & {
      name: string;
      message: string;
      cause?: unknown;
    };
    type: "error";
  }, {
    error: {
      error?: string | undefined;
      name?: string | undefined;
      message?: string | undefined;
      stack?: string | undefined;
    } & {
      name: string;
      message: string;
      cause?: unknown;
    };
    type?: "error" | undefined;
  }>]>, z.ZodObject<{
    type: z.ZodDefault<z.ZodOptional<z.ZodLiteral<"input">>>;
    input: z.ZodEffects<z.ZodAny, any, any>;
  }, "strict", z.ZodTypeAny, {
    type: "input";
    input?: any;
  }, {
    type?: "input" | undefined;
    input?: any;
  }>]>, z.ZodEffects<z.ZodAny, {
    type: "data";
    data: any;
  }, any>]>>>;
};
type StepsResponse = { [V in ExecutionVersion]: z.infer<(typeof stepsSchemas)[V]> }[ExecutionVersion];
declare const batchSchema: z.ZodArray<z.ZodEffects<z.ZodRecord<z.ZodString, z.ZodAny>, EventPayload<any>, Record<string, any>>, "many">;
type BatchResponse = z.infer<typeof batchSchema>;
//#endregion
export { BatchResponse, ErrorResponse, StepsResponse };
//# sourceMappingURL=schema.d.ts.map