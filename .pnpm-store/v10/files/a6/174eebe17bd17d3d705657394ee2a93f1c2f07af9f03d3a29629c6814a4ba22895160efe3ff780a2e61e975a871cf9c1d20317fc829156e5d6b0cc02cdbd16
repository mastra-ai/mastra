"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseNot = void 0;
const parseSchema_js_1 = require("./parseSchema.js");
const parseNot = (schema, refs) => {
    return `z.any().refine((value) => !${(0, parseSchema_js_1.parseSchema)(schema.not, {
        ...refs,
        path: [...refs.path, "not"],
    })}.safeParse(value).success, "Invalid input: Should NOT be valid against schema")`;
};
exports.parseNot = parseNot;
