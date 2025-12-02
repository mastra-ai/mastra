"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseXAddArguments = void 0;
/**
 * Parses arguments for the XADD command
 *
 * @param optional - Optional command modifier
 * @param parser - The command parser
 * @param key - The stream key
 * @param id - Message ID (* for auto-generation)
 * @param message - Key-value pairs representing the message fields
 * @param options - Additional options for stream trimming
 */
function parseXAddArguments(optional, parser, key, id, message, options) {
    parser.push('XADD');
    parser.pushKey(key);
    if (optional) {
        parser.push(optional);
    }
    if (options?.TRIM) {
        if (options.TRIM.strategy) {
            parser.push(options.TRIM.strategy);
        }
        if (options.TRIM.strategyModifier) {
            parser.push(options.TRIM.strategyModifier);
        }
        parser.push(options.TRIM.threshold.toString());
        if (options.TRIM.limit) {
            parser.push('LIMIT', options.TRIM.limit.toString());
        }
        if (options.TRIM.policy) {
            parser.push(options.TRIM.policy);
        }
    }
    parser.push(id);
    for (const [key, value] of Object.entries(message)) {
        parser.push(key, value);
    }
}
exports.parseXAddArguments = parseXAddArguments;
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Constructs the XADD command to append a new entry to a stream
     *
     * @param parser - The command parser
     * @param key - The stream key
     * @param id - Message ID (* for auto-generation)
     * @param message - Key-value pairs representing the message fields
     * @param options - Additional options for stream trimming
     * @returns The ID of the added entry
     * @see https://redis.io/commands/xadd/
     */
    parseCommand(...args) {
        return parseXAddArguments(undefined, ...args);
    },
    transformReply: undefined
};
//# sourceMappingURL=XADD.js.map