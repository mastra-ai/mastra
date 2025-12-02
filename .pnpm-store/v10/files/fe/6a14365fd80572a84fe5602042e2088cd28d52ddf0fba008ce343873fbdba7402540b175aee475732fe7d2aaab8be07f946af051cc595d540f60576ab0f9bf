import { none, some } from './maybe';
function all(maybies) {
    var result = [];
    for (var _i = 0, maybies_1 = maybies; _i < maybies_1.length; _i++) {
        var item = maybies_1[_i];
        if (item.isNone()) {
            return none;
        }
        result.push(item.orThrow());
    }
    return some(result);
}
export { all };
