"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseSortArguments = void 0;
/**
 * Parses sort arguments for the SORT command
 *
 * @param parser - The command parser
 * @param key - The key to sort
 * @param options - Sort options
 */
function parseSortArguments(parser, key, options) {
    parser.pushKey(key);
    if (options?.BY) {
        parser.push('BY', options.BY);
    }
    if (options?.LIMIT) {
        parser.push('LIMIT', options.LIMIT.offset.toString(), options.LIMIT.count.toString());
    }
    if (options?.GET) {
        if (Array.isArray(options.GET)) {
            for (const pattern of options.GET) {
                parser.push('GET', pattern);
            }
        }
        else {
            parser.push('GET', options.GET);
        }
    }
    if (options?.DIRECTION) {
        parser.push(options.DIRECTION);
    }
    if (options?.ALPHA) {
        parser.push('ALPHA');
    }
}
exports.parseSortArguments = parseSortArguments;
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Constructs the SORT command
     *
     * @param parser - The command parser
     * @param key - The key to sort (list, set, or sorted set)
     * @param options - Sort options
     * @see https://redis.io/commands/sort/
     */
    parseCommand(parser, key, options) {
        parser.push('SORT');
        parseSortArguments(parser, key, options);
    },
    transformReply: undefined
};
//# sourceMappingURL=SORT.js.map