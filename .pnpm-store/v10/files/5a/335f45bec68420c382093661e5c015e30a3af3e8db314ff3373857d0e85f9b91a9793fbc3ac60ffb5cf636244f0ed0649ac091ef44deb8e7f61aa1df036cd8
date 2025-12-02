"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseNullable = void 0;
const omit_js_1 = require("../utils/omit.js");
const parseSchema_js_1 = require("./parseSchema.js");
/**
 * For compatibility with open api 3.0 nullable
 */
const parseNullable = (schema, refs) => {
    return `${(0, parseSchema_js_1.parseSchema)((0, omit_js_1.omit)(schema, "nullable"), refs, true)}.nullable()`;
};
exports.parseNullable = parseNullable;
