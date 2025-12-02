"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseMultipleType = void 0;
const parseSchema_js_1 = require("./parseSchema.js");
const parseMultipleType = (schema, refs) => {
    return `z.union([${schema.type
        .map((type) => (0, parseSchema_js_1.parseSchema)({ ...schema, type }, { ...refs, withoutDefaults: true }))
        .join(", ")}])`;
};
exports.parseMultipleType = parseMultipleType;
