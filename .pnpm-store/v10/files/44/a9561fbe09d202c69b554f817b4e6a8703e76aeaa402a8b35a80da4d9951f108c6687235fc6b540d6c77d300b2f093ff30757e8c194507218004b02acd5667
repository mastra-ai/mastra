"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Controls whether to prevent the client's connections from being evicted
     * @param parser - The Redis command parser
     * @param value - Whether to enable (true) or disable (false) the no-evict mode
     */
    parseCommand(parser, value) {
        parser.push('CLIENT', 'NO-EVICT', value ? 'ON' : 'OFF');
    },
    transformReply: undefined
};
//# sourceMappingURL=CLIENT_NO-EVICT.js.map