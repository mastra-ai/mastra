"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Resets the statistics reported by Redis using the INFO command
     * @param parser - The Redis command parser
     */
    parseCommand(parser) {
        parser.push('CONFIG', 'RESETSTAT');
    },
    transformReply: undefined
};
//# sourceMappingURL=CONFIG_RESETSTAT.js.map