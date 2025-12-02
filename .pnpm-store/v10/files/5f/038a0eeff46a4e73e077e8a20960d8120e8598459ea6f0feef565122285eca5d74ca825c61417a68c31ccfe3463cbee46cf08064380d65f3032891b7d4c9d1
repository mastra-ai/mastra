import { none, maybe, some } from './maybe';
export function allProperties(object) {
    var result = {};
    var keys = Object.keys(object);
    for (var _i = 0, keys_1 = keys; _i < keys_1.length; _i++) {
        var key = keys_1[_i];
        var value = maybe(object[key]);
        if (value.isNone()) {
            return none;
        }
        result[key] = value.orThrow();
    }
    return some(result);
}
