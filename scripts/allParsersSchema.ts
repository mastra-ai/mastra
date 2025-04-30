import { z } from "zod";

enum nativeEnum {
  "a",
  "b",
  "c",
}

const baseAllParsersSchema = z.object({
  any: z.any(),
  array: z.array(z.any()),
  arrayMin: z.array(z.any()).min(1),
  arrayMax: z.array(z.any()).max(1),
  arrayMinMax: z.array(z.any()).min(1).max(1),
  bigInt: z.bigint(),
  boolean: z.boolean(),
  date: z.date(),
  default: z.any().default(42),
  effectRefine: z.string().refine((x) => x + x),
  effectTransform: z.string().transform((x) => !!x),
  effectPreprocess: z.preprocess((x) => {
    try {
      return JSON.stringify(x);
    } catch {
      return "wahh";
    }
  }, z.string()),
  enum: z.enum(["hej", "svejs"]),
  intersection: z.intersection(z.string().min(1), z.string().max(4)),
  literal: z.literal("hej"),
  map: z.map(z.string().uuid(), z.boolean()),
  nativeEnum: z.nativeEnum(nativeEnum),
  never: z.never() as any,
  null: z.null(),
  nullablePrimitive: z.string().nullable(),
  nullableObject: z.object({ hello: z.string() }).nullable(),
  number: z.number(),
  numberGt: z.number().gt(1),
  numberLt: z.number().lt(1),
  numberGtLt: z.number().gt(1).lt(1),
  numberGte: z.number().gte(1),
  numberLte: z.number().lte(1),
  numberGteLte: z.number().gte(1).lte(1),
  numberMultipleOf: z.number().multipleOf(2),
  numberInt: z.number().int(),
  objectPasstrough: z
    .object({ foo: z.string(), bar: z.number().optional() })
    .passthrough(),
  objectCatchall: z
    .object({ foo: z.string(), bar: z.number().optional() })
    .catchall(z.boolean()),
  objectStrict: z
    .object({ foo: z.string(), bar: z.number().optional() })
    .strict(),
  objectStrip: z
    .object({ foo: z.string(), bar: z.number().optional() })
    .strip(),
  promise: z.promise(z.string()),
  recordStringBoolean: z.record(z.string(), z.boolean()),
  recordUuidBoolean: z.record(z.string().uuid(), z.boolean()),
  recordBooleanBoolean: z.record(z.boolean(), z.boolean()),
  set: z.set(z.string()),
  string: z.string(),
  stringMin: z.string().min(1),
  stringMax: z.string().max(1),
  stringEmail: z.string().email(),
  stringEmoji: z.string().emoji(),
  stringUrl: z.string().url(),
  stringUuid: z.string().uuid(),
  stringRegEx: z.string().regex(new RegExp("abc")),
  stringCuid: z.string().cuid(),
  tuple: z.tuple([z.string(), z.number(), z.boolean()]),
  undefined: z.undefined(),
  unionPrimitives: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.bigint(),
    z.null(),
  ]),
  unionPrimitiveLiterals: z.union([
    z.literal(123),
    z.literal("abc"),
    z.literal(null),
    z.literal(true),
    // z.literal(1n), // target es2020
  ]),
  unionNonPrimitives: z.union([
    z.string(),
    z.object({
      foo: z.string(),
      bar: z.number().optional(),
    }),
  ]),
  unknown: z.unknown(),
});

export const allParsersSchema = baseAllParsersSchema
  .partial()
  .default({ string: "hello" })
  .describe("watup");

export { baseAllParsersSchema };
