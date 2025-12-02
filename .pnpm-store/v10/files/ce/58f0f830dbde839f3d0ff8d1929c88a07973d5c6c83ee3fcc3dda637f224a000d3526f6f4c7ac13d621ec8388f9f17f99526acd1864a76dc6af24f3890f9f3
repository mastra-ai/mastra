"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Instructs the server about tracking or not keys in the next request
     * @param parser - The Redis command parser
     * @param value - Whether to enable (true) or disable (false) tracking
     */
    parseCommand(parser, value) {
        parser.push('CLIENT', 'CACHING', value ? 'YES' : 'NO');
    },
    transformReply: undefined
};
//# sourceMappingURL=CLIENT_CACHING.js.map