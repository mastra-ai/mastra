"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.last = exports.isCycle = exports.jsonPathStringify = void 0;
var jsonPathStringify = function (s) {
    return s
        .map(function (i) {
        if (i === "") {
            return "$";
        }
        else {
            return ".".concat(i);
        }
    })
        .join("");
};
exports.jsonPathStringify = jsonPathStringify;
var isCycle = function (s, recursiveStack) {
    var foundInRecursiveStack = recursiveStack.find(function (recSchema) { return recSchema === s; });
    if (foundInRecursiveStack) {
        return foundInRecursiveStack;
    }
    return false;
};
exports.isCycle = isCycle;
var last = function (i, skip) {
    if (skip === void 0) { skip = 1; }
    return i[i.length - skip];
};
exports.last = last;
