"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseTop = parseTop;
const top_node_js_1 = require("../operation-node/top-node.js");
const object_utils_js_1 = require("../util/object-utils.js");
function parseTop(expression, modifiers) {
    if (!(0, object_utils_js_1.isNumber)(expression) && !(0, object_utils_js_1.isBigInt)(expression)) {
        throw new Error(`Invalid top expression: ${expression}`);
    }
    if (!(0, object_utils_js_1.isUndefined)(modifiers) && !isTopModifiers(modifiers)) {
        throw new Error(`Invalid top modifiers: ${modifiers}`);
    }
    return top_node_js_1.TopNode.create(expression, modifiers);
}
function isTopModifiers(modifiers) {
    return (modifiers === 'percent' ||
        modifiers === 'with ties' ||
        modifiers === 'percent with ties');
}
