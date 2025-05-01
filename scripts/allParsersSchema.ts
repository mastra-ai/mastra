import { z } from 'zod';

enum nativeEnum {
  'a',
  'b',
  'c',
}

const allParsers = z.object({
  // any: z.any(),
  array: z.array(z.string()),
  arrayMin: z.array(z.string()).min(1),
  arrayMax: z.array(z.string()).max(1),
  arrayMinMax: z.array(z.string()).min(1).max(1),
  boolean: z.boolean(),
  // date: z.date(), // TODO: probably don't need this. the model passes a date string which errors but it can't pass an actual date object..
  default: z.number().default(42),
  enum: z.enum(['hej', 'svejs']),
  // intersection: z.intersection(z.string().min(1), z.string().max(4)),
  optionalString: z.string().optional(),
  // literal: z.literal("hej"), // TODO: Support this probably
  // never: z.never() as any, // TODO: Support this probably
  nativeEnum: z.nativeEnum(nativeEnum),
  null: z.null().describe(`make sure you pass null not "null" (no quotes)`),
  nullablePrimitive: z.string().nullable(),
  nullableObject: z.object({ hello: z.string() }).nullable(),
  number: z.number(),
  numberGt: z.number().gt(3),
  numberLt: z.number().lt(1),
  numberGtLt: z.number().gt(0.5).lt(2),
  numberGte: z.number().gte(1),
  numberLte: z.number().lte(1),
  numberGteLte: z.number().gte(1).lte(1),
  numberMultipleOf: z.number().multipleOf(2),
  numberInt: z.number().int(),
  objectPasstrough: z.object({ foo: z.string(), bar: z.number().optional() }).passthrough(),
  objectCatchall: z.object({ foo: z.string(), bar: z.number().optional() }).catchall(z.boolean()),
  objectStrict: z.object({ foo: z.string(), bar: z.number().optional() }).strict(),
  objectStrip: z.object({ foo: z.string(), bar: z.number().optional() }).strip(),
  string: z.string(),
  stringMin: z.string().min(1),
  stringMax: z.string().max(1),
  stringEmail: z.string().email(),
  stringEmoji: z.string().emoji(),
  stringUrl: z.string().url(),
  stringUuid: z.string().uuid(),
  stringRegEx: z.string().regex(new RegExp('abc')),
  stringCuid: z.string().cuid(),
  // tuple: z.tuple([z.string(), z.number(), z.boolean()]), // TODO: Support this
  // undefined: z.undefined(),
  unionPrimitives: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  unionPrimitiveLiterals: z.union([
    z.literal(123),
    z.literal('abc'),
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
  // unknown: z.unknown(),
});

export { allParsers };

/*
We do not support:
  - refine
  - transform
  - preprocess
  - bigInt
  - map
  - promise
  - record
  - set
*/

/*
 we will add support for:
  - date
  - literal
  - never
  - stringEmoji
  - tuple
*/
