"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseNumber = void 0;
const withMessage_js_1 = require("../utils/withMessage.js");
const parseNumber = (schema) => {
    let r = "z.number()";
    if (schema.type === "integer") {
        r += (0, withMessage_js_1.withMessage)(schema, "type", () => [".int(", ")"]);
    }
    else {
        r += (0, withMessage_js_1.withMessage)(schema, "format", ({ value }) => {
            if (value === "int64") {
                return [".int(", ")"];
            }
        });
    }
    r += (0, withMessage_js_1.withMessage)(schema, "multipleOf", ({ value, json }) => {
        if (value === 1) {
            if (r.startsWith("z.number().int(")) {
                return;
            }
            return [".int(", ")"];
        }
        return [`.multipleOf(${json}`, ", ", ")"];
    });
    if (typeof schema.minimum === "number") {
        if (schema.exclusiveMinimum === true) {
            r += (0, withMessage_js_1.withMessage)(schema, "minimum", ({ json }) => [
                `.gt(${json}`,
                ", ",
                ")",
            ]);
        }
        else {
            r += (0, withMessage_js_1.withMessage)(schema, "minimum", ({ json }) => [
                `.gte(${json}`,
                ", ",
                ")",
            ]);
        }
    }
    else if (typeof schema.exclusiveMinimum === "number") {
        r += (0, withMessage_js_1.withMessage)(schema, "exclusiveMinimum", ({ json }) => [
            `.gt(${json}`,
            ", ",
            ")",
        ]);
    }
    if (typeof schema.maximum === "number") {
        if (schema.exclusiveMaximum === true) {
            r += (0, withMessage_js_1.withMessage)(schema, "maximum", ({ json }) => [
                `.lt(${json}`,
                ", ",
                ")",
            ]);
        }
        else {
            r += (0, withMessage_js_1.withMessage)(schema, "maximum", ({ json }) => [
                `.lte(${json}`,
                ", ",
                ")",
            ]);
        }
    }
    else if (typeof schema.exclusiveMaximum === "number") {
        r += (0, withMessage_js_1.withMessage)(schema, "exclusiveMaximum", ({ json }) => [
            `.lt(${json}`,
            ", ",
            ")",
        ]);
    }
    return r;
};
exports.parseNumber = parseNumber;
