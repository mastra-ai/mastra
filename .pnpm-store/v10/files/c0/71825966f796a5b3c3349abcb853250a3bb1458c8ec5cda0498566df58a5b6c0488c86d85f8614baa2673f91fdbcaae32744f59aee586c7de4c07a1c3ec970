"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultOptions = void 0;
var utils_1 = require("./utils");
exports.defaultOptions = {
    skipFirstMutation: false,
    mutable: false,
    bfs: false,
};
/**
 * Traverse all subschema of a schema, calling the mutator function with each.
 * The mutator is called on leaf nodes first.
 *
 * @param schema the schema to traverse
 * @param mutation the function to pass each node in the subschema tree.
 * @param traverseOptions a set of options for traversal.
 * @param depth For internal use. Tracks the current recursive depth in the tree. This is used to implement
 *              some of the options.
 *
 */
function traverse(schema, mutation, traverseOptions, depth, recursiveStack, mutableStack, pathStack, prePostMap, cycleSet) {
    if (traverseOptions === void 0) { traverseOptions = exports.defaultOptions; }
    if (depth === void 0) { depth = 0; }
    if (recursiveStack === void 0) { recursiveStack = []; }
    if (mutableStack === void 0) { mutableStack = []; }
    if (pathStack === void 0) { pathStack = []; }
    if (prePostMap === void 0) { prePostMap = []; }
    if (cycleSet === void 0) { cycleSet = []; }
    var opts = __assign(__assign({}, exports.defaultOptions), traverseOptions); // would be nice to make an 'entry' func when we get around to optimizations
    // booleans are a bit messed. Since all other schemas are objects (non-primitive type
    // which gets a new address in mem) for each new JS refer to one of 2 memory addrs, and
    // thus adding it to the recursive stack will prevent it from being explored if the
    // boolean is seen in a further nested schema.
    if (depth === 0) {
        pathStack = [""];
    }
    if (typeof schema === "boolean" || schema instanceof Boolean) {
        if (opts.skipFirstMutation === true && depth === 0) {
            return schema;
        }
        else {
            return mutation(schema, false, (0, utils_1.jsonPathStringify)(pathStack), (0, utils_1.last)(mutableStack));
        }
    }
    var mutableSchema = schema;
    if (opts.mutable === false) {
        mutableSchema = __assign({}, schema);
    }
    mutableStack.push(mutableSchema);
    if (opts.bfs === true) {
        if (opts.skipFirstMutation === false || depth !== 0) {
            mutableSchema = mutation(mutableSchema, false, (0, utils_1.jsonPathStringify)(pathStack), (0, utils_1.last)(mutableStack, 2));
        }
    }
    recursiveStack.push(schema);
    prePostMap.push([schema, mutableSchema]);
    var rec = function (s, path) {
        var foundCycle = (0, utils_1.isCycle)(s, recursiveStack);
        if (foundCycle) {
            cycleSet.push(foundCycle);
            // if the cycle is a ref to the root schema && skipFirstMutation is try we need to call mutate.
            // If we don't, it will never happen.
            if (opts.skipFirstMutation === true && foundCycle === recursiveStack[0]) {
                return mutation(s, true, (0, utils_1.jsonPathStringify)(path), (0, utils_1.last)(mutableStack));
            }
            var _a = prePostMap.find(function (_a) {
                var orig = _a[0];
                return foundCycle === orig;
            }), cycledMutableSchema = _a[1];
            return cycledMutableSchema;
        }
        // else
        return traverse(s, mutation, traverseOptions, depth + 1, recursiveStack, mutableStack, path, prePostMap, cycleSet);
    };
    if (schema.anyOf) {
        mutableSchema.anyOf = schema.anyOf.map(function (x, i) {
            var result = rec(x, __spreadArray(__spreadArray([], pathStack, true), ["anyOf[".concat(i, "]")], false));
            return result;
        });
    }
    else if (schema.allOf) {
        mutableSchema.allOf = schema.allOf.map(function (x, i) {
            var result = rec(x, __spreadArray(__spreadArray([], pathStack, true), ["allOf[".concat(i, "]")], false));
            return result;
        });
    }
    else if (schema.oneOf) {
        mutableSchema.oneOf = schema.oneOf.map(function (x, i) {
            var result = rec(x, __spreadArray(__spreadArray([], pathStack, true), ["oneOf[".concat(i, "]")], false));
            return result;
        });
    }
    else {
        if (schema.items) {
            if (schema.items instanceof Array) {
                mutableSchema.items = schema.items.map(function (x, i) {
                    var result = rec(x, __spreadArray(__spreadArray([], pathStack, true), ["items[".concat(i, "]")], false));
                    return result;
                });
            }
            else {
                var foundCycle_1 = (0, utils_1.isCycle)(schema.items, recursiveStack);
                if (foundCycle_1) {
                    cycleSet.push(foundCycle_1);
                    if (opts.skipFirstMutation === true && foundCycle_1 === recursiveStack[0]) {
                        mutableSchema.items = mutation(schema.items, true, (0, utils_1.jsonPathStringify)(pathStack), (0, utils_1.last)(mutableStack));
                    }
                    else {
                        var _a = prePostMap.find(function (_a) {
                            var orig = _a[0];
                            return foundCycle_1 === orig;
                        }), cycledMutableSchema = _a[1];
                        mutableSchema.items = cycledMutableSchema;
                    }
                }
                else {
                    mutableSchema.items = traverse(schema.items, mutation, traverseOptions, depth + 1, recursiveStack, mutableStack, __spreadArray(__spreadArray([], pathStack, true), ["items"], false), prePostMap, cycleSet);
                }
            }
        }
        if (schema.additionalItems !== undefined) {
            mutableSchema.additionalItems = rec(schema.additionalItems, __spreadArray(__spreadArray([], pathStack, true), ["additionalItems"], false));
        }
        if (schema.contains !== undefined) {
            mutableSchema.contains = rec(schema.contains, __spreadArray(__spreadArray([], pathStack, true), ["contains"], false));
        }
        if (schema.unevaluatedItems !== undefined) {
            mutableSchema.unevaluatedItems = rec(schema.unevaluatedItems, __spreadArray(__spreadArray([], pathStack, true), ["unevaluatedItems"], false));
        }
        if (schema.properties !== undefined) {
            var sProps_1 = schema.properties;
            var mutableProps_1 = {};
            Object.keys(schema.properties).forEach(function (schemaPropKey) {
                mutableProps_1[schemaPropKey] = rec(sProps_1[schemaPropKey], __spreadArray(__spreadArray([], pathStack, true), ["properties", schemaPropKey.toString()], false));
            });
            mutableSchema.properties = mutableProps_1;
        }
        if (schema.patternProperties !== undefined) {
            var sProps_2 = schema.patternProperties;
            var mutableProps_2 = {};
            Object.keys(schema.patternProperties).forEach(function (regex) {
                mutableProps_2[regex] = rec(sProps_2[regex], __spreadArray(__spreadArray([], pathStack, true), ["patternProperties", regex.toString()], false));
            });
            mutableSchema.patternProperties = mutableProps_2;
        }
        if (schema.additionalProperties !== undefined && !!schema.additionalProperties === true) {
            mutableSchema.additionalProperties = rec(schema.additionalProperties, __spreadArray(__spreadArray([], pathStack, true), ["additionalProperties"], false));
        }
        if (schema.propertyNames !== undefined) {
            mutableSchema.propertyNames = rec(schema.propertyNames, __spreadArray(__spreadArray([], pathStack, true), ["propertyNames"], false));
        }
        if (schema.unevaluatedProperties !== undefined && !!schema.unevaluatedProperties === true) {
            mutableSchema.unevaluatedProperties = rec(schema.unevaluatedProperties, __spreadArray(__spreadArray([], pathStack, true), ["unevaluatedProperties"], false));
        }
    }
    if (opts.skipFirstMutation === true && depth === 0) {
        return mutableSchema;
    }
    if (opts.bfs === true) {
        mutableStack.pop();
        return mutableSchema;
    }
    else {
        var isCycleNode = cycleSet.indexOf(schema) !== -1;
        mutableStack.pop();
        return mutation(mutableSchema, isCycleNode, (0, utils_1.jsonPathStringify)(pathStack), (0, utils_1.last)(mutableStack));
    }
}
exports.default = traverse;
