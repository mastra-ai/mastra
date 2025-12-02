"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Resumes processing of client commands after a CLIENT PAUSE
     * @param parser - The Redis command parser
     */
    parseCommand(parser) {
        parser.push('CLIENT', 'UNPAUSE');
    },
    transformReply: undefined
};
//# sourceMappingURL=CLIENT_UNPAUSE.js.map