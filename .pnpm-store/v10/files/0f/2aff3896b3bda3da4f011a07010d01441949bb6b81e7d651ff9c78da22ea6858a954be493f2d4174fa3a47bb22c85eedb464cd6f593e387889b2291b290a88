"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseIfThenElse = void 0;
const parseSchema_js_1 = require("./parseSchema.js");
const parseIfThenElse = (schema, refs) => {
    const $if = (0, parseSchema_js_1.parseSchema)(schema.if, { ...refs, path: [...refs.path, "if"] });
    const $then = (0, parseSchema_js_1.parseSchema)(schema.then, {
        ...refs,
        path: [...refs.path, "then"],
    });
    const $else = (0, parseSchema_js_1.parseSchema)(schema.else, {
        ...refs,
        path: [...refs.path, "else"],
    });
    return `z.union([${$then}, ${$else}]).superRefine((value,ctx) => {
  const result = ${$if}.safeParse(value).success
    ? ${$then}.safeParse(value)
    : ${$else}.safeParse(value);
  if (!result.success) {
    result.error.errors.forEach((error) => ctx.addIssue(error))
  }
})`;
};
exports.parseIfThenElse = parseIfThenElse;
