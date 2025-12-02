"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    /**
     * Constructs the HSET command
     *
     * @param parser - The command parser
     * @param key - The key of the hash
     * @param value - Either the field name (when using single field) or an object/map/array of field-value pairs
     * @param fieldValue - The value to set (only used with single field variant)
     * @see https://redis.io/commands/hset/
     */
    parseCommand(parser, ...[key, value, fieldValue]) {
        parser.push('HSET');
        parser.pushKey(key);
        if (typeof value === 'string' || typeof value === 'number' || value instanceof Buffer) {
            parser.push(convertValue(value), convertValue(fieldValue));
        }
        else if (value instanceof Map) {
            pushMap(parser, value);
        }
        else if (Array.isArray(value)) {
            pushTuples(parser, value);
        }
        else {
            pushObject(parser, value);
        }
    },
    transformReply: undefined
};
function pushMap(parser, map) {
    for (const [key, value] of map.entries()) {
        parser.push(convertValue(key), convertValue(value));
    }
}
function pushTuples(parser, tuples) {
    for (const tuple of tuples) {
        if (Array.isArray(tuple)) {
            pushTuples(parser, tuple);
            continue;
        }
        parser.push(convertValue(tuple));
    }
}
function pushObject(parser, object) {
    for (const key of Object.keys(object)) {
        parser.push(convertValue(key), convertValue(object[key]));
    }
}
function convertValue(value) {
    return typeof value === 'number' ?
        value.toString() :
        value;
}
//# sourceMappingURL=HSET.js.map