"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASKING_CMD = void 0;
exports.ASKING_CMD = 'ASKING';
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Tells a Redis cluster node that the client is ok receiving such redirects
     * @param parser - The Redis command parser
     */
    parseCommand(parser) {
        parser.push(exports.ASKING_CMD);
    },
    transformReply: undefined
};
//# sourceMappingURL=ASKING.js.map