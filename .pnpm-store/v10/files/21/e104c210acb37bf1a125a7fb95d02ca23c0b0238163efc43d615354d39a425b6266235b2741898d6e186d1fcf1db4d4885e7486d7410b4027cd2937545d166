"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const parser_1 = require("../client/parser");
exports.default = {
    /**
     * Constructs the HSETEX command
     *
     * @param parser - The command parser
     * @param key - The key of the hash
     * @param fields - Object, Map, or Array of field-value pairs to set
     * @param options - Optional configuration for expiration and mode settings
     * @see https://redis.io/commands/hsetex/
     */
    parseCommand(parser, key, fields, options) {
        parser.push('HSETEX');
        parser.pushKey(key);
        if (options?.mode) {
            parser.push(options.mode);
        }
        if (options?.expiration) {
            if (typeof options.expiration === 'string') {
                parser.push(options.expiration);
            }
            else if (options.expiration.type === 'KEEPTTL') {
                parser.push('KEEPTTL');
            }
            else {
                parser.push(options.expiration.type, options.expiration.value.toString());
            }
        }
        parser.push('FIELDS');
        if (fields instanceof Map) {
            pushMap(parser, fields);
        }
        else if (Array.isArray(fields)) {
            pushTuples(parser, fields);
        }
        else {
            pushObject(parser, fields);
        }
    },
    transformReply: undefined
};
function pushMap(parser, map) {
    parser.push(map.size.toString());
    for (const [key, value] of map.entries()) {
        parser.push(convertValue(key), convertValue(value));
    }
}
function pushTuples(parser, tuples) {
    const tmpParser = new parser_1.BasicCommandParser;
    _pushTuples(tmpParser, tuples);
    if (tmpParser.redisArgs.length % 2 != 0) {
        throw Error('invalid number of arguments, expected key value ....[key value] pairs, got key without value');
    }
    parser.push((tmpParser.redisArgs.length / 2).toString());
    parser.push(...tmpParser.redisArgs);
}
function _pushTuples(parser, tuples) {
    for (const tuple of tuples) {
        if (Array.isArray(tuple)) {
            _pushTuples(parser, tuple);
            continue;
        }
        parser.push(convertValue(tuple));
    }
}
function pushObject(parser, object) {
    const len = Object.keys(object).length;
    if (len == 0) {
        throw Error('object without keys');
    }
    parser.push(len.toString());
    for (const key of Object.keys(object)) {
        parser.push(convertValue(key), convertValue(object[key]));
    }
}
function convertValue(value) {
    return typeof value === 'number' ? value.toString() : value;
}
//# sourceMappingURL=HSETEX.js.map