"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Controls whether to prevent the client from touching the LRU/LFU of keys
     * @param parser - The Redis command parser
     * @param value - Whether to enable (true) or disable (false) the no-touch mode
     */
    parseCommand(parser, value) {
        parser.push('CLIENT', 'NO-TOUCH', value ? 'ON' : 'OFF');
    },
    transformReply: undefined
};
//# sourceMappingURL=CLIENT_NO-TOUCH.js.map