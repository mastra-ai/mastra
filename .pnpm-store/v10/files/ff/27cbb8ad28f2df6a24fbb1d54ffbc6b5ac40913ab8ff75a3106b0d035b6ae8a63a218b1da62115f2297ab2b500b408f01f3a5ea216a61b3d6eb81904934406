"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Adds one or more observations to a t-digest sketch
     * @param parser - The command parser
     * @param key - The name of the t-digest sketch
     * @param values - Array of numeric values to add to the sketch
     */
    parseCommand(parser, key, values) {
        parser.push('TDIGEST.ADD');
        parser.pushKey(key);
        for (const value of values) {
            parser.push(value.toString());
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=ADD.js.map