"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseSimpleDiscriminatedOneOf = void 0;
const parseSchema_js_1 = require("./parseSchema.js");
const parseSimpleDiscriminatedOneOf = (schema, refs) => {
    return schema.oneOf.length
        ? schema.oneOf.length === 1
            ? (0, parseSchema_js_1.parseSchema)(schema.oneOf[0], {
                ...refs,
                path: [...refs.path, "oneOf", 0],
            })
            : `z.discriminatedUnion("${schema.discriminator.propertyName}", [${schema.oneOf
                .map((schema, i) => (0, parseSchema_js_1.parseSchema)(schema, {
                ...refs,
                path: [...refs.path, "oneOf", i],
            }))
                .join(", ")}])`
        : "z.any()";
};
exports.parseSimpleDiscriminatedOneOf = parseSimpleDiscriminatedOneOf;
