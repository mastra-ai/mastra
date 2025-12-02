"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseFetch = parseFetch;
const fetch_node_js_1 = require("../operation-node/fetch-node.js");
const object_utils_js_1 = require("../util/object-utils.js");
function parseFetch(rowCount, modifier) {
    if (!(0, object_utils_js_1.isNumber)(rowCount) && !(0, object_utils_js_1.isBigInt)(rowCount)) {
        throw new Error(`Invalid fetch row count: ${rowCount}`);
    }
    if (!isFetchModifier(modifier)) {
        throw new Error(`Invalid fetch modifier: ${modifier}`);
    }
    return fetch_node_js_1.FetchNode.create(rowCount, modifier);
}
function isFetchModifier(value) {
    return value === 'only' || value === 'with ties';
}
