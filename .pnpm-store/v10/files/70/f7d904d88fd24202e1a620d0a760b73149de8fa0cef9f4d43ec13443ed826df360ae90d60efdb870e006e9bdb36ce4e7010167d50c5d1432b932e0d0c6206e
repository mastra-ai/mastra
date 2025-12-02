"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function compact(items) {
    var result = [];
    for (var _i = 0, items_1 = items; _i < items_1.length; _i++) {
        var item = items_1[_i];
        var unpacked = item.orNull();
        if (unpacked !== null) {
            result.push(unpacked);
        }
    }
    return result;
}
exports.compact = compact;
