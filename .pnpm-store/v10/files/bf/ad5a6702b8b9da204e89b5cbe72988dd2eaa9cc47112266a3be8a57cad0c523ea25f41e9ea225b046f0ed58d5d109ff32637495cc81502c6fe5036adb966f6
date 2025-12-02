"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseLMPopArguments = void 0;
function parseLMPopArguments(parser, keys, side, options) {
    parser.pushKeysLength(keys);
    parser.push(side);
    if (options?.COUNT !== undefined) {
        parser.push('COUNT', options.COUNT.toString());
    }
}
exports.parseLMPopArguments = parseLMPopArguments;
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Constructs the LMPOP command
     *
     * @param parser - The command parser
     * @param args - Arguments including keys, side (LEFT or RIGHT), and options
     * @see https://redis.io/commands/lmpop/
     */
    parseCommand(parser, ...args) {
        parser.push('LMPOP');
        parseLMPopArguments(parser, ...args);
    },
    transformReply: undefined
};
//# sourceMappingURL=LMPOP.js.map