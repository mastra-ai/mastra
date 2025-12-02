"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseAllOf = void 0;
const parseSchema_js_1 = require("./parseSchema.js");
const half_js_1 = require("../utils/half.js");
const originalIndex = Symbol("Original index");
const ensureOriginalIndex = (arr) => {
    let newArr = [];
    for (let i = 0; i < arr.length; i++) {
        const item = arr[i];
        if (typeof item === "boolean") {
            newArr.push(item ? { [originalIndex]: i } : { [originalIndex]: i, not: {} });
        }
        else if (originalIndex in item) {
            return arr;
        }
        else {
            newArr.push({ ...item, [originalIndex]: i });
        }
    }
    return newArr;
};
function parseAllOf(schema, refs) {
    if (schema.allOf.length === 0) {
        return "z.never()";
    }
    else if (schema.allOf.length === 1) {
        const item = schema.allOf[0];
        return (0, parseSchema_js_1.parseSchema)(item, {
            ...refs,
            path: [...refs.path, "allOf", item[originalIndex]],
        });
    }
    else {
        const [left, right] = (0, half_js_1.half)(ensureOriginalIndex(schema.allOf));
        return `z.intersection(${parseAllOf({ allOf: left }, refs)}, ${parseAllOf({
            allOf: right,
        }, refs)})`;
    }
}
exports.parseAllOf = parseAllOf;
