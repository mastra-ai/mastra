"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseOneOf = void 0;
const parseSchema_js_1 = require("./parseSchema.js");
const parseOneOf = (schema, refs) => {
    return schema.oneOf.length
        ? schema.oneOf.length === 1
            ? (0, parseSchema_js_1.parseSchema)(schema.oneOf[0], {
                ...refs,
                path: [...refs.path, "oneOf", 0],
            })
            : `z.any().superRefine((x, ctx) => {
    const schemas = [${schema.oneOf
                .map((schema, i) => (0, parseSchema_js_1.parseSchema)(schema, {
                ...refs,
                path: [...refs.path, "oneOf", i],
            }))
                .join(", ")}];
    const errors = schemas.reduce<z.ZodError[]>(
      (errors, schema) =>
        ((result) =>
          result.error ? [...errors, result.error] : errors)(
          schema.safeParse(x),
        ),
      [],
    );
    if (schemas.length - errors.length !== 1) {
      ctx.addIssue({
        path: ctx.path,
        code: "invalid_union",
        unionErrors: errors,
        message: "Invalid input: Should pass single schema",
      });
    }
  })`
        : "z.any()";
};
exports.parseOneOf = parseOneOf;
