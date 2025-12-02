"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Resets a t-digest sketch, clearing all previously added observations
     * @param parser - The command parser
     * @param key - The name of the t-digest sketch to reset
     */
    parseCommand(parser, key) {
        parser.push('TDIGEST.RESET');
        parser.pushKey(key);
    },
    transformReply: undefined
};
//# sourceMappingURL=RESET.js.map