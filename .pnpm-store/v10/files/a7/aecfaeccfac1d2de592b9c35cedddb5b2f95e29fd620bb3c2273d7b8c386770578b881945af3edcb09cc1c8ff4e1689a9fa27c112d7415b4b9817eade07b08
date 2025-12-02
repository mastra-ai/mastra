import { z } from "zod";
import { looseObject } from "./utils.js";

const baseConvexValidator = z.discriminatedUnion("type", [
  looseObject({ type: z.literal("null") }),
  looseObject({ type: z.literal("number") }),
  looseObject({ type: z.literal("bigint") }),
  looseObject({ type: z.literal("boolean") }),
  looseObject({ type: z.literal("string") }),
  looseObject({ type: z.literal("bytes") }),
  looseObject({ type: z.literal("any") }),
  looseObject({ type: z.literal("literal"), value: z.any() }),
  looseObject({ type: z.literal("id"), tableName: z.string() }),
]);
export type ConvexValidator =
  | z.infer<typeof baseConvexValidator>
  | { type: "array"; value: ConvexValidator }
  | {
      type: "record";
      keys: ConvexValidator;
      values: { fieldType: ConvexValidator; optional: false };
    }
  | { type: "union"; value: ConvexValidator[] }
  | {
      type: "object";
      value: Record<string, { fieldType: ConvexValidator; optional: boolean }>;
    };
export const convexValidator: z.ZodType<ConvexValidator> = z.lazy(() =>
  z.union([
    baseConvexValidator,
    looseObject({ type: z.literal("array"), value: convexValidator }),
    looseObject({
      type: z.literal("record"),
      keys: convexValidator,
      values: z.object({
        fieldType: convexValidator,
        optional: z.literal(false),
      }),
    }),
    looseObject({
      type: z.literal("union"),
      value: z.array(convexValidator),
    }),
    looseObject({
      type: z.literal("object"),
      value: z.record(
        looseObject({
          fieldType: convexValidator,
          optional: z.boolean(),
        }),
      ),
    }),
  ]),
);
