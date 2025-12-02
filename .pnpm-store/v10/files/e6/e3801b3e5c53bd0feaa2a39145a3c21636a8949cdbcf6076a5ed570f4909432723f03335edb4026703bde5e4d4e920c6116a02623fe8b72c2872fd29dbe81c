"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseArray = void 0;
const withMessage_js_1 = require("../utils/withMessage.js");
const parseSchema_js_1 = require("./parseSchema.js");
const parseArray = (schema, refs) => {
    if (Array.isArray(schema.items)) {
        return `z.tuple([${schema.items.map((v, i) => (0, parseSchema_js_1.parseSchema)(v, { ...refs, path: [...refs.path, "items", i] }))}])`;
    }
    let r = !schema.items
        ? "z.array(z.any())"
        : `z.array(${(0, parseSchema_js_1.parseSchema)(schema.items, {
            ...refs,
            path: [...refs.path, "items"],
        })})`;
    r += (0, withMessage_js_1.withMessage)(schema, "minItems", ({ json }) => [
        `.min(${json}`,
        ", ",
        ")",
    ]);
    r += (0, withMessage_js_1.withMessage)(schema, "maxItems", ({ json }) => [
        `.max(${json}`,
        ", ",
        ")",
    ]);
    if (schema.uniqueItems === true) {
        r += (0, withMessage_js_1.withMessage)(schema, "uniqueItems", () => [
            ".unique(",
            "",
            ")",
        ]);
    }
    return r;
};
exports.parseArray = parseArray;
