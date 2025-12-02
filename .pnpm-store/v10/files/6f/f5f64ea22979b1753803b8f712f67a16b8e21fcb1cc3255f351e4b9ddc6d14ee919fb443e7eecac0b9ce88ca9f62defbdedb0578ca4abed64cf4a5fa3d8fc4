"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var maybe_1 = require("./maybe");
function allProperties(object) {
    var result = {};
    var keys = Object.keys(object);
    for (var _i = 0, keys_1 = keys; _i < keys_1.length; _i++) {
        var key = keys_1[_i];
        var value = maybe_1.maybe(object[key]);
        if (value.isNone()) {
            return maybe_1.none;
        }
        result[key] = value.orThrow();
    }
    return maybe_1.some(result);
}
exports.allProperties = allProperties;
