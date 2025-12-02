"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseAnyOf = void 0;
const parseSchema_js_1 = require("./parseSchema.js");
const parseAnyOf = (schema, refs) => {
    return schema.anyOf.length
        ? schema.anyOf.length === 1
            ? (0, parseSchema_js_1.parseSchema)(schema.anyOf[0], {
                ...refs,
                path: [...refs.path, "anyOf", 0],
            })
            : `z.union([${schema.anyOf
                .map((schema, i) => (0, parseSchema_js_1.parseSchema)(schema, { ...refs, path: [...refs.path, "anyOf", i] }))
                .join(", ")}])`
        : `z.any()`;
};
exports.parseAnyOf = parseAnyOf;
