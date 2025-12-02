"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var maybe_1 = require("./maybe");
function all(maybies) {
    var result = [];
    for (var _i = 0, maybies_1 = maybies; _i < maybies_1.length; _i++) {
        var item = maybies_1[_i];
        if (item.isNone()) {
            return maybe_1.none;
        }
        result.push(item.orThrow());
    }
    return maybe_1.some(result);
}
exports.all = all;
